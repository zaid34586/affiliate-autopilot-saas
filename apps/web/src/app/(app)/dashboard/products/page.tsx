import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return <ModulePage href="/dashboard/products" />;
}
