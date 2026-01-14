import { MobileNumberRecord } from '@myorganizer/core';
import { Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { formatMobileNumber } from '../utils/formatMobileNumber';

export function MobileNumberDetailsCard(props: {
  mobileNumberRecord: MobileNumberRecord;
}) {
  const { mobileNumberRecord } = props;
  const hasStructuredNumber = !!(
    mobileNumberRecord.countryCode && mobileNumberRecord.phoneNumber
  );

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <CardTitle className="text-xl font-semibold">
          {mobileNumberRecord.label}
        </CardTitle>
      </div>
      <CardContent className="p-0 space-y-4">
        {hasStructuredNumber ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Country Code
                </p>
                <p className="text-sm font-mono">
                  {mobileNumberRecord.countryCode}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Phone Number
                </p>
                <p className="text-sm font-mono">
                  {mobileNumberRecord.phoneNumber}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Formatted Number
              </p>
              <p className="text-base font-mono font-semibold">
                {formatMobileNumber(mobileNumberRecord)}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Mobile Number
            </p>
            <p className="text-base font-mono font-semibold">
              {formatMobileNumber(mobileNumberRecord)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
