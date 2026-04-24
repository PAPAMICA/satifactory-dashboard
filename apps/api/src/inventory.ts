import { getPool } from "./db.js";
import { frmFetchJson } from "./frm.js";

export type InvItem = {
  Name: string;
  ClassName: string;
  Amount: number;
  MaxAmount: number;
};

type CrateRow = { Inventory?: InvItem[] };

function addItems(
  map: Map<string, { className: string; name: string; amount: number }>,
  items: InvItem[] | undefined,
) {
  if (!items) return;
  for (const it of items) {
    const key = it.ClassName;
    const prev = map.get(key);
    const amt = Number(it.Amount) || 0;
    if (prev) {
      prev.amount += amt;
    } else {
      map.set(key, {
        className: key,
        name: it.Name || key,
        amount: amt,
      });
    }
  }
}

export async function buildInventorySummary(): Promise<
  {
    className: string;
    name: string;
    amount: number;
    favorite: boolean;
  }[]
> {
  const [world, cloud, crates] = await Promise.all([
    frmFetchJson<InvItem[]>("/getWorldInv"),
    frmFetchJson<InvItem[]>("/getCloudInv"),
    frmFetchJson<CrateRow[]>("/getCrateInv"),
  ]);

  const map = new Map<
    string,
    { className: string; name: string; amount: number }
  >();
  addItems(map, world);
  addItems(map, cloud);
  for (const c of crates ?? []) {
    addItems(map, c.Inventory);
  }

  const { rows: favRows } = await getPool().query<{ class_name: string }>(
    "SELECT class_name FROM favorites",
  );
  const fav = new Set(favRows.map((r) => r.class_name));

  return [...map.values()]
    .map((v) => ({
      className: v.className,
      name: v.name,
      amount: v.amount,
      favorite: fav.has(v.className),
    }))
    .sort((a, b) => b.amount - a.amount);
}
