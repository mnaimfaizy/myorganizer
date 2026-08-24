import { ExportVaultCard, ImportVaultCard } from './components';

export default function VaultExportPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <ExportVaultCard />
      <ImportVaultCard />
    </div>
  );
}
