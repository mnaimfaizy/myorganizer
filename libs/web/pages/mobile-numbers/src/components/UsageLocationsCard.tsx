import { UsageLocationRecord } from '@myorganizer/core';
import { Card, CardContent, CardTitle } from '@myorganizer/web-ui';

import { titleCase } from '../utils/enumUtils';

export function UsageLocationsCard(props: {
  usageLocations: UsageLocationRecord[];
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Used at</CardTitle>
      <CardContent className="mt-4 space-y-3">
        {props.usageLocations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No usage locations yet.
          </p>
        ) : (
          props.usageLocations.map((u) => (
            <div key={u.id} className="space-y-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.organisationName}</p>
                  <p className="text-xs text-muted-foreground">
                    {titleCase(u.organisationType)} •{' '}
                    {titleCase(u.updateMethod)}
                    {u.priority ? ` • ${titleCase(u.priority)}` : ''}
                    {u.changed ? ' • Changed' : ''}
                  </p>
                  {u.link ? (
                    <a
                      href={u.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline-offset-4 hover:underline"
                    >
                      {u.link}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
