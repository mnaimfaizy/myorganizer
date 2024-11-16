import { Button } from "@myorganizer/web-ui";

export default function Index() {
  /*
   * Replace the elements below with your own.
   *
   * Note: The corresponding styles are in the ./index.tailwind file.
   */
  return (
    <div className="flex items-center gap-3 p-2">
      <Button variant={"default"}>Default</Button>
      <Button variant={"destructive"}>Destructive</Button>
      <Button variant={"outline"}>Outline</Button>
      <Button variant={"secondary"}>Secondary</Button>
      <Button variant={"ghost"}>Ghost</Button>
      <Button variant={"link"}>Link</Button>
    </div>
  );
}
