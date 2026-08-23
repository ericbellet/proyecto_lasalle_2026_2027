import { LinkButton } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-5xl font-bold tracking-tight text-accent-fg">404</p>
      <h1 className="text-xl font-semibold tracking-tight">This page does not exist</h1>
      <p className="max-w-md text-sm text-fg-muted">
        The student, stock or prediction you asked for is not in this season&apos;s dataset.
      </p>
      <LinkButton href="/" variant="secondary" size="sm">
        Back to the dashboard
      </LinkButton>
    </div>
  );
}
