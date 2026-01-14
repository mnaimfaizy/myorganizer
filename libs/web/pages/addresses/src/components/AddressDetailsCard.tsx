import { AddressRecord } from '@myorganizer/core';
import { Badge, Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { formatAddress } from '../utils/formatAddress';

export function AddressDetailsCard(props: { addressRecord: AddressRecord }) {
  const { addressRecord } = props;
  const fullAddress = formatAddress(addressRecord);
  const hasStructuredAddress = !!(
    addressRecord.street ||
    addressRecord.suburb ||
    addressRecord.country
  );

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <CardTitle className="text-xl font-semibold">
          {addressRecord.label}
        </CardTitle>
        <Badge
          variant={addressRecord.status === 'current' ? 'default' : 'outline'}
        >
          {addressRecord.status}
        </Badge>
      </div>
      <CardContent className="p-0 space-y-4">
        {hasStructuredAddress ? (
          <div className="space-y-3">
            {addressRecord.propertyNumber && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Property Number
                </p>
                <p className="text-sm">{addressRecord.propertyNumber}</p>
              </div>
            )}
            {addressRecord.street && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Street
                </p>
                <p className="text-sm">{addressRecord.street}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {addressRecord.suburb && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Suburb/City
                  </p>
                  <p className="text-sm">{addressRecord.suburb}</p>
                </div>
              )}
              {addressRecord.state && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    State/Province
                  </p>
                  <p className="text-sm">{addressRecord.state}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {addressRecord.zipCode && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Zip/Postal Code
                  </p>
                  <p className="text-sm">{addressRecord.zipCode}</p>
                </div>
              )}
              {addressRecord.country && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Country
                  </p>
                  <p className="text-sm">{addressRecord.country}</p>
                </div>
              )}
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Full Address
              </p>
              <p className="text-sm">{fullAddress}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Address
            </p>
            <p className="text-sm text-muted-foreground">{fullAddress}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
