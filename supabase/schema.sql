-- ============================================================================
-- Cownter: esquema do Supabase (login por fazenda + sincronização)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run.
-- Pode rodar de novo sem problema (ele só cria o que ainda não existe).
-- ============================================================================

-- Uma fazenda, com um código de convite para outras pessoas entrarem.
create table if not exists public.fazendas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text not null unique,
  criado_por uuid not null,
  criado_em timestamptz not null default now()
);

-- Quem participa de cada fazenda (por enquanto, cada pessoa em uma fazenda só).
create table if not exists public.membros (
  fazenda_id uuid not null references public.fazendas (id) on delete cascade,
  user_id uuid not null,
  nome text,
  papel text not null default 'membro',
  entrou_em timestamptz not null default now(),
  primary key (fazenda_id, user_id)
);
create unique index if not exists membros_um_por_usuario on public.membros (user_id);

-- Todos os dados do app (lotes, pastos, vendas...), um registro por linha.
-- "dados" guarda o registro inteiro como o aparelho o enxerga.
create table if not exists public.registros (
  fazenda_id uuid not null references public.fazendas (id) on delete cascade,
  tabela text not null,
  id uuid not null,
  dados jsonb not null,
  atualizado_em timestamptz not null,           -- relógio do aparelho que alterou
  excluido boolean not null default false,
  servidor_em timestamptz not null default clock_timestamp(),  -- relógio do servidor (usado para baixar o que mudou)
  primary key (fazenda_id, tabela, id)
);
create index if not exists registros_servidor on public.registros (fazenda_id, servidor_em);

-- ---------------------------------------------------------------------------
-- Segurança: cada pessoa só enxerga a própria fazenda. Ninguém escreve direto
-- nas tabelas; toda escrita passa pelas funções abaixo.
-- ---------------------------------------------------------------------------
create or replace function public.minhas_fazendas()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select fazenda_id from public.membros where user_id = auth.uid() $$;

alter table public.fazendas enable row level security;
alter table public.membros enable row level security;
alter table public.registros enable row level security;

drop policy if exists "ver minha fazenda" on public.fazendas;
create policy "ver minha fazenda" on public.fazendas
  for select to authenticated using (id in (select public.minhas_fazendas()));

drop policy if exists "ver membros da minha fazenda" on public.membros;
create policy "ver membros da minha fazenda" on public.membros
  for select to authenticated using (fazenda_id in (select public.minhas_fazendas()));

drop policy if exists "ver registros da minha fazenda" on public.registros;
create policy "ver registros da minha fazenda" on public.registros
  for select to authenticated using (fazenda_id in (select public.minhas_fazendas()));

revoke all on public.fazendas, public.membros, public.registros from anon;
revoke insert, update, delete on public.fazendas, public.membros, public.registros from authenticated;
grant select on public.fazendas, public.membros, public.registros to authenticated;

-- ---------------------------------------------------------------------------
-- Funções usadas pelo app
-- ---------------------------------------------------------------------------
create or replace function public.novo_codigo_convite()
returns text language plpgsql volatile set search_path = public
as $$
declare c text;
begin
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.fazendas where codigo = c);
  end loop;
  return c;
end $$;

-- Cria a fazenda e coloca quem criou como dono.
create or replace function public.criar_fazenda(p_nome text, p_nome_usuario text)
returns table (id uuid, nome text, codigo text, papel text)
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_codigo text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta primeiro.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome da fazenda.'; end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then
    raise exception 'Você já participa de uma fazenda.';
  end if;
  v_codigo := public.novo_codigo_convite();
  insert into public.fazendas (nome, codigo, criado_por) values (trim(p_nome), v_codigo, auth.uid())
    returning fazendas.id into v_id;
  insert into public.membros (fazenda_id, user_id, nome, papel) values (v_id, auth.uid(), nullif(trim(p_nome_usuario), ''), 'dono');
  return query select f.id, f.nome, f.codigo, 'dono'::text from public.fazendas f where f.id = v_id;
end $$;

-- Entra em uma fazenda existente com o código de convite.
create or replace function public.entrar_na_fazenda(p_codigo text, p_nome_usuario text)
returns table (id uuid, nome text, codigo text, papel text)
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta primeiro.'; end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then
    raise exception 'Você já participa de uma fazenda.';
  end if;
  select f.id into v_id from public.fazendas f where f.codigo = upper(trim(p_codigo));
  if v_id is null then raise exception 'Código de convite inválido.'; end if;
  insert into public.membros (fazenda_id, user_id, nome, papel) values (v_id, auth.uid(), nullif(trim(p_nome_usuario), ''), 'membro');
  return query select f.id, f.nome, f.codigo, 'membro'::text from public.fazendas f where f.id = v_id;
end $$;

-- A fazenda de quem está logado (vazio se ainda não tem).
create or replace function public.minha_fazenda()
returns table (id uuid, nome text, codigo text, papel text)
language sql stable security definer set search_path = public
as $$
  select f.id, f.nome, case when m.papel = 'dono' then f.codigo else null end, m.papel
  from public.membros m join public.fazendas f on f.id = m.fazenda_id
  where m.user_id = auth.uid()
$$;

-- Troca o código de convite (só o dono). O código antigo deixa de funcionar.
create or replace function public.gerar_novo_codigo()
returns text language plpgsql security definer set search_path = public
as $$
declare v_codigo text;
begin
  v_codigo := public.novo_codigo_convite();
  update public.fazendas set codigo = v_codigo
   where id in (select fazenda_id from public.membros where user_id = auth.uid() and papel = 'dono');
  if not found then raise exception 'Só o dono da fazenda pode gerar um novo código.'; end if;
  return v_codigo;
end $$;

-- Recebe do aparelho os registros alterados. Regra de conflito: vale o que foi
-- salvo por último (atualizado_em mais recente); um registro excluído nunca é
-- "desexcluído" por uma edição.
create or replace function public.enviar_registros(p_registros jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_fazenda uuid; r jsonb; n integer := 0;
begin
  select fazenda_id into v_fazenda from public.membros where user_id = auth.uid();
  if v_fazenda is null then raise exception 'Você ainda não participa de uma fazenda.'; end if;
  if jsonb_typeof(p_registros) <> 'array' then raise exception 'Formato inválido.'; end if;
  for r in select * from jsonb_array_elements(p_registros) loop
    if (r->>'tabela') not in ('pastos','lotesGado','cabecas','tarefas','notas','partos',
                              'recursos','comprasRecurso','usosRecurso','movimentacoes') then
      raise exception 'Tabela inválida: %', r->>'tabela';
    end if;
    insert into public.registros (fazenda_id, tabela, id, dados, atualizado_em, excluido)
    values (v_fazenda, r->>'tabela', (r->>'id')::uuid, r->'dados', (r->>'atualizado_em')::timestamptz,
            (r->'dados'->>'deletedAt') is not null)
    on conflict (fazenda_id, tabela, id) do update
      set dados = excluded.dados, atualizado_em = excluded.atualizado_em,
          excluido = excluded.excluido, servidor_em = clock_timestamp()
      where excluded.atualizado_em >= public.registros.atualizado_em
        and (excluded.excluido or not public.registros.excluido);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.minhas_fazendas(), public.novo_codigo_convite(), public.criar_fazenda(text, text),
  public.entrar_na_fazenda(text, text), public.minha_fazenda(), public.gerar_novo_codigo(),
  public.enviar_registros(jsonb) from public, anon;
grant execute on function public.minhas_fazendas(), public.criar_fazenda(text, text),
  public.entrar_na_fazenda(text, text), public.minha_fazenda(), public.gerar_novo_codigo(),
  public.enviar_registros(jsonb) to authenticated;

-- ============================================================================
-- Etapa 9: conta e fazenda (nome, membros, exclusão)
-- ============================================================================

-- Troca o meu nome na fazenda.
create or replace function public.atualizar_meu_nome(p_nome text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta primeiro.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o seu nome.'; end if;
  update public.membros set nome = trim(p_nome) where user_id = auth.uid();
end $$;

-- Troca o nome da fazenda (só o dono).
create or replace function public.renomear_fazenda(p_nome text)
returns text language plpgsql security definer set search_path = public
as $$
declare v_nome text := trim(coalesce(p_nome, ''));
begin
  if v_nome = '' then raise exception 'Informe o nome da fazenda.'; end if;
  update public.fazendas set nome = v_nome
   where id in (select fazenda_id from public.membros where user_id = auth.uid() and papel = 'dono');
  if not found then raise exception 'Só o dono da fazenda pode trocar o nome.'; end if;
  return v_nome;
end $$;

-- Quem participa da minha fazenda ("voce" marca a minha linha).
create or replace function public.listar_membros()
returns table (user_id uuid, nome text, papel text, entrou_em timestamptz, voce boolean)
language sql stable security definer set search_path = public
as $$
  select m.user_id, m.nome, m.papel, m.entrou_em, (m.user_id = auth.uid())
  from public.membros m
  where m.fazenda_id in (select fazenda_id from public.membros where user_id = auth.uid())
  order by m.entrou_em
$$;

-- Tira uma pessoa da fazenda (só o dono; o dono não se remove). A conta dela continua
-- existindo, mas ela perde o acesso aos dados da fazenda.
create or replace function public.remover_membro(p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_fazenda uuid;
begin
  select fazenda_id into v_fazenda from public.membros where user_id = auth.uid() and papel = 'dono';
  if v_fazenda is null then raise exception 'Só o dono da fazenda pode remover pessoas.'; end if;
  delete from public.membros where fazenda_id = v_fazenda and user_id = p_user_id and papel <> 'dono';
  if not found then raise exception 'Não foi possível remover esta pessoa.'; end if;
end $$;

-- Apaga a fazenda com todos os dados e a conta do dono (só o dono). Quem participava
-- perde o acesso e, ao entrar de novo, precisa criar uma fazenda ou usar outro código.
create or replace function public.excluir_fazenda_e_conta()
returns void language plpgsql security definer set search_path = public, auth
as $$
declare v_fazenda uuid;
begin
  select fazenda_id into v_fazenda from public.membros where user_id = auth.uid() and papel = 'dono';
  if v_fazenda is null then raise exception 'Só o dono da fazenda pode excluir a conta.'; end if;
  delete from public.fazendas where id = v_fazenda;   -- apaga membros e registros junto
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.atualizar_meu_nome(text), public.renomear_fazenda(text), public.listar_membros(),
  public.remover_membro(uuid), public.excluir_fazenda_e_conta() from public, anon;
grant execute on function public.atualizar_meu_nome(text), public.renomear_fazenda(text), public.listar_membros(),
  public.remover_membro(uuid), public.excluir_fazenda_e_conta() to authenticated;
