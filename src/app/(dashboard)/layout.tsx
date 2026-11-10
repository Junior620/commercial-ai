import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ConfirmProvider } from "@/components/shared/confirm-dialog";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, reason } = await getCurrentUser();
  if (!user) redirect(reason === "forbidden" ? "/login?error=forbidden" : "/login");

  return (
    <ConfirmProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Aller au contenu
        </a>
        <Sidebar className="hidden md:flex" />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header user={{ name: user.name, email: user.email, role: user.role }} />
          <main id="contenu" className="flex-1 overflow-y-auto px-3 py-5 sm:px-5 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
}
