import { ExportVaultCard } from './components/ExportVaultCard';
import { ImportVaultCard } from './components/ImportVaultCard';

export default function VaultExportPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <ExportVaultCard />
      <ImportVaultCard />
    </div>
  );
}
