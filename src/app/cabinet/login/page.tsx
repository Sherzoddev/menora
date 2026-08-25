import LoginForm from "./login-form";

export default async function CabinetLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; activated?: string }>;
}) {
  const { redirect, activated } = await searchParams;
  return <LoginForm redirectTo={redirect ?? "/cabinet"} justActivated={activated === "1"} />;
}
