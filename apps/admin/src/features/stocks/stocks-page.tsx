'use client';

import { Database, Ellipsis, Pencil, Plus, Search, Trash2 } from 'lucide-react';

import { EXCHANGES, type Exchange, type Sector, SECTORS } from '@sarwa/contracts';
import { dollarsToCents, useAdminI18n } from '@sarwa/core/admin';
import {
  Badge,
  Button,
  Callout,
  Card,
  cn,
  Dialog,
  IconButton,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  SortHeader,
  StateView,
  StockAvatar,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
  Select,
} from '@sarwa/ui';

import {
  GuardedButton,
  GuardedSwitch,
  Locked,
  ReadOnlyBadge,
  ViewerNotice,
} from '../../components/common/access';
import { LoadError, PageHeader, TableSkeleton } from '../../components/common/states';
import { StockDialog } from './stock-dialog';
import { type StockSortKey, type StocksPageModel, useStocksPage } from './use-stocks-page';

const narrow = 'max-md:hidden';

function StocksTable({ page }: { page: StocksPageModel }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.stocks;
  const sortable = (key: StockSortKey, align: 'start' | 'end' = 'start', className?: string) => (
    <SortHeader
      label={copy.columns[key]}
      align={align}
      className={className}
      direction={page.sort.key === key ? page.sort.direction : 'none'}
      onSort={() => {
        page.actions.sortBy(key);
      }}
    />
  );

  return (
    <Table label={copy.title}>
      <THead>
        <TRow>
          {sortable('symbol')}
          {sortable('name', 'start', narrow)}
          {sortable('sector')}
          {sortable('exchange', 'start', narrow)}
          {sortable('basePrice', 'end')}
          {sortable('volatility', 'end', narrow)}
          <TH align="end" className={narrow}>
            {copy.columns.marketCap}
          </TH>
          <TH align="end" className={narrow}>
            {copy.columns.pe}
          </TH>
          <TH>{copy.columns.enabled}</TH>
          <TH align="end">
            <span className="sr-only">{copy.columns.actions}</span>
          </TH>
        </TRow>
      </THead>
      <TBody>
        {page.rows.map((stock) => (
          <TRow key={stock.symbol}>
            <TCell>
              <span className="flex items-center gap-2.5">
                <StockAvatar symbol={stock.symbol} sector={stock.sector} size={32} />
                <b>{stock.symbol}</b>
              </span>
            </TCell>
            <TCell className={cn('text-fg-2 max-w-55 truncate', narrow)}>{stock.name}</TCell>
            <TCell>
              <Badge>{t.sectors[stock.sector]}</Badge>
            </TCell>
            <TCell className={cn('text-fg-2', narrow)}>{stock.exchange}</TCell>
            <TCell align="end" className="font-semibold">
              {f.money(dollarsToCents(stock.basePrice))}
            </TCell>
            <TCell align="end" className={narrow}>
              <Badge tone={stock.volatility >= 2 ? 'warn' : 'neutral'}>
                {f.multiplier(stock.volatility)}
              </Badge>
            </TCell>
            <TCell align="end" className={cn('text-fg-2', narrow)}>
              {f.money(dollarsToCents(stock.marketCap), { compact: true })}
            </TCell>
            <TCell align="end" className={cn('text-fg-2', narrow)}>
              {stock.peRatio === null ? '—' : f.number(stock.peRatio)}
            </TCell>
            <TCell>
              <GuardedSwitch
                locked={!page.canEdit}
                checked={stock.isEnabled}
                aria-label={
                  stock.isEnabled
                    ? copy.disable({ symbol: stock.symbol })
                    : copy.enable({ symbol: stock.symbol })
                }
                onCheckedChange={(checked) => {
                  page.actions.setEnabled(stock.symbol, checked);
                }}
              />
            </TCell>
            <TCell align="end">
              <Menu>
                <Locked locked={!page.canEdit}>
                  <MenuTrigger asChild>
                    <IconButton size={32} label={copy.actionsFor({ symbol: stock.symbol })}>
                      <Ellipsis aria-hidden className="size-4" />
                    </IconButton>
                  </MenuTrigger>
                </Locked>
                <MenuContent>
                  <MenuItem
                    icon={<Pencil />}
                    onSelect={() => {
                      page.dialog.actions.openEdit(stock);
                    }}
                  >
                    {copy.edit}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    danger
                    icon={<Trash2 />}
                    onSelect={() => {
                      page.actions.askDelete(stock.symbol);
                    }}
                  >
                    {copy.delete}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </TCell>
          </TRow>
        ))}
      </TBody>
    </Table>
  );
}

function DeleteDialog({ page }: { page: StocksPageModel }) {
  const { t } = useAdminI18n();
  const copy = t.admin.stocks;
  const symbol = page.deletion.symbol ?? '';
  const conflict = page.deletion.conflict;
  return (
    <Dialog
      open={page.deletion.symbol !== null}
      onOpenChange={(open) => {
        if (!open) page.actions.closeDelete();
      }}
      title={conflict ? copy.conflictTitle({ symbol }) : copy.deleteTitle({ symbol })}
      description={conflict ? copy.conflictBody : copy.deleteBody}
      footer={
        <>
          <Button variant="ghost" onClick={page.actions.closeDelete}>
            {t.common.cancel}
          </Button>
          {conflict ? (
            <Button onClick={page.actions.disableInstead}>{copy.disableInstead}</Button>
          ) : (
            <Button
              variant="danger"
              loading={page.deletion.isDeleting}
              onClick={page.actions.confirmDelete}
            >
              {copy.delete}
            </Button>
          )}
        </>
      }
    >
      {page.deletion.failed ? (
        <Callout tone="neg" urgent>
          {t.admin.states.actionFailed}
        </Callout>
      ) : null}
    </Dialog>
  );
}

export function StocksPage() {
  const page = useStocksPage();
  const { t, f } = useAdminI18n();
  const copy = t.admin.stocks;
  const addButton = (label: string) => (
    <GuardedButton
      locked={!page.canEdit}
      icon={<Plus aria-hidden className="size-4" />}
      disabled={page.isLoading}
      onClick={page.dialog.actions.openCreate}
    >
      {label}
    </GuardedButton>
  );

  const body = page.isError ? (
    <LoadError what={copy.loading} onRetry={page.actions.retry} />
  ) : page.isLoading ? (
    <TableSkeleton columns={8} rows={7} label={copy.loading} />
  ) : page.total === 0 ? (
    <StateView
      className="flex-1 justify-center"
      tone="brand"
      icon={<Database />}
      title={copy.empty}
      description={copy.emptyBody}
      action={addButton(copy.addFirst)}
    />
  ) : page.rows.length === 0 ? (
    <StateView
      className="flex-1 justify-center"
      icon={<Search />}
      title={copy.noMatch({ q: page.search.trim() })}
      action={
        <Button variant="secondary" size="sm" onClick={page.actions.clearSearch}>
          {copy.clearSearch}
        </Button>
      }
    />
  ) : (
    <StocksTable page={page} />
  );

  return (
    <>
      {page.isViewer ? <ViewerNotice /> : null}
      <PageHeader
        title={copy.title}
        subtitle={
          page.isLoading
            ? undefined
            : copy.subtitle({ listed: f.number(page.total), enabled: f.number(page.enabledCount) })
        }
      >
        {page.isViewer ? <ReadOnlyBadge /> : null}
        {addButton(copy.add)}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-85 max-sm:w-full">
          <Input
            type="search"
            icon={<Search />}
            className="w-full"
            aria-label={copy.searchLabel}
            placeholder={copy.search}
            value={page.search}
            onChange={(event) => {
              page.actions.search(event.target.value);
            }}
          />
        </div>
        <Select
          aria-label={copy.columns.sector}
          className="w-45"
          value={page.sector}
          onChange={(event) => {
            page.actions.setSector(event.target.value as Sector | 'all');
          }}
        >
          <option value="all">{copy.allSectors}</option>
          {SECTORS.map((sector) => (
            <option key={sector} value={sector}>
              {t.sectors[sector]}
            </option>
          ))}
        </Select>
        <Select
          aria-label={copy.columns.exchange}
          className="w-40"
          value={page.exchange}
          onChange={(event) => {
            page.actions.setExchange(event.target.value as Exchange | 'all');
          }}
        >
          <option value="all">{copy.allExchanges}</option>
          {EXCHANGES.map((exchange) => (
            <option key={exchange} value={exchange}>
              {exchange}
            </option>
          ))}
        </Select>
      </div>
      {page.toggleFailed ? (
        <Callout tone="neg" urgent>
          {t.admin.states.actionFailed}
        </Callout>
      ) : null}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {body}
        {page.rows.length > 0 && !page.isLoading ? (
          <p className="border-border type-sm text-fg-2 mt-auto border-t px-4 py-3 tabular-nums">
            {copy.showing({ n: f.number(page.rows.length), total: f.number(page.total) })}
          </p>
        ) : null}
      </Card>
      <StockDialog dialog={page.dialog} />
      <DeleteDialog page={page} />
    </>
  );
}
