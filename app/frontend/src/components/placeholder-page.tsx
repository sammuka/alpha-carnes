interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({
  title,
  description = 'Esta tela será implementada nas próximas fases do projeto.',
}: PlaceholderPageProps) {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
