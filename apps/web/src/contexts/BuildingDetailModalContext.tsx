import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ProductionBuildingModal } from "@/components/ProductionBuildingModal";

type OpenOpts = {
  showMap?: boolean;
  /** Si omis, la modale applique encore la vérif admin en interne. */
  showAdminControls?: boolean;
  onClosed?: () => void;
};

type Ctx = {
  openBuilding: (row: Record<string, unknown>, opts?: OpenOpts) => void;
};

const BuildingDetailCtx = createContext<Ctx | null>(null);

export function useOpenBuildingDetail(): Ctx["openBuilding"] {
  const c = useContext(BuildingDetailCtx);
  return c?.openBuilding ?? (() => {});
}

export function BuildingDetailModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    row: Record<string, unknown>;
    showMap: boolean;
    showAdminControls: boolean;
    onClosed?: () => void;
  } | null>(null);

  const openBuilding = useCallback((row: Record<string, unknown>, opts?: OpenOpts) => {
    setState({
      row,
      showMap: opts?.showMap !== false,
      showAdminControls: Boolean(opts?.showAdminControls),
      onClosed: opts?.onClosed,
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => {
      prev?.onClosed?.();
      return null;
    });
  }, []);

  const value = useMemo(() => ({ openBuilding }), [openBuilding]);

  return (
    <BuildingDetailCtx.Provider value={value}>
      {children}
      {state ?
        <ProductionBuildingModal
          row={state.row}
          onClose={close}
          showMap={state.showMap}
          showAdminControls={state.showAdminControls}
        />
      : null}
    </BuildingDetailCtx.Provider>
  );
}
