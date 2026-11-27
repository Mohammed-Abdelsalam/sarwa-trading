'use client';

import {
  Bell,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import {
  Button,
  Callout,
  Card,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Skeleton,
  StateView,
  StatusBadge,
  StockAvatar,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from '@sarwa/ui';

import { AlertDialog } from './alert-dialog';
import { useAlertsPage } from './use-alerts-page';

export function AlertsPage() {
  const page = useAlertsPage();
  const { labels, actions } = page;

  return (
    <div className="mx-auto flex w-full max-w-330 flex-col gap-4.5 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-h1">{labels.title}</h1>
          <p className="type-sm text-fg-2 tabular-nums">{labels.subtitle}</p>
        </div>
        <Button
          icon={<Plus aria-hidden className="size-4" />}
          disabled={page.limitReached}
          onClick={actions.openDialog}
        >
          {labels.newAlert}
        </Button>
      </div>

      {page.limitReached ? (
        <Callout tone="warn" icon={<TriangleAlert />}>
          {labels.limitReached}
        </Callout>
      ) : null}

      {page.priming ? (
        <Callout
          tone="info"
          icon={<Bell />}
          action={
            <Button size="sm" variant="secondary" onClick={actions.enableNotifications}>
              {labels.enable}
            </Button>
          }
        >
          <b className="font-semibold">{labels.primingTitle}</b> {labels.primingBody}
        </Callout>
      ) : null}

      <Card className="overflow-hidden">
        {page.isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : page.isError ? (
          <StateView
            tone="neg"
            icon={<TriangleAlert />}
            title={labels.loadError}
            action={
              <Button
                variant="secondary"
                icon={<RefreshCw aria-hidden className="size-4" />}
                onClick={actions.retry}
              >
                {labels.retry}
              </Button>
            }
          />
        ) : page.rows.length === 0 ? (
          <StateView icon={<Bell />} title={labels.empty} />
        ) : (
          <Table label={labels.title}>
            <THead>
              <tr>
                <TH className="ps-4">{labels.columns.symbol}</TH>
                <TH>{labels.columns.condition}</TH>
                <TH className="max-md:hidden">{labels.columns.distance}</TH>
                <TH className="max-md:hidden">{labels.columns.repeat}</TH>
                <TH>{labels.columns.status}</TH>
                <TH align="end">
                  <span className="sr-only">{labels.actions}</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {page.rows.map((row) => (
                <TRow key={row.id}>
                  <TCell className="ps-4">
                    <span className="flex items-center gap-2.5">
                      <StockAvatar symbol={row.symbol} sector={row.sector} size={32} />
                      <b>{row.symbol}</b>
                    </span>
                  </TCell>
                  <TCell>{row.condition}</TCell>
                  <TCell className="text-fg-3 max-md:hidden">{row.distance}</TCell>
                  <TCell className="text-fg-2 max-md:hidden">{row.repeat}</TCell>
                  <TCell>
                    <StatusBadge status={row.state} label={row.stateLabel} />
                  </TCell>
                  <TCell align="end">
                    <Menu>
                      <MenuTrigger asChild>
                        <IconButton label={`${labels.actions} · ${row.symbol}`} size={32}>
                          <MoreHorizontal aria-hidden className="size-4" />
                        </IconButton>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem
                          icon={row.enabled ? <Pause /> : <Play />}
                          onSelect={() => {
                            actions.setEnabled(row.id, !row.enabled);
                          }}
                        >
                          {row.enabled ? labels.pause : labels.resume}
                        </MenuItem>
                        <MenuItem
                          danger
                          icon={<Trash2 />}
                          onSelect={() => {
                            actions.remove(row.id);
                          }}
                        >
                          {labels.delete}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {page.dialog.open ? (
        <AlertDialog initialSymbol={page.dialog.symbol} onClose={actions.closeDialog} />
      ) : null}
    </div>
  );
}
