import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@/components/ui/select";
import type { ProductOption } from "@/lib/product-catalog";

/** Options d'un sélecteur de produit : cœur de cible d'abord, produits secondaires ensuite. */
export function ProductOptions({ options }: { options: ProductOption[] }) {
  const core = options.filter((o) => o.group === "core");
  const secondary = options.filter((o) => o.group === "secondary");
  return (
    <>
      <SelectGroup>
        <SelectLabel>Fèves et dérivés</SelectLabel>
        {core.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label}
          </SelectItem>
        ))}
      </SelectGroup>
      {secondary.length ? (
        <>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Autres produits (secondaires)</SelectLabel>
            {secondary.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </>
      ) : null}
    </>
  );
}
