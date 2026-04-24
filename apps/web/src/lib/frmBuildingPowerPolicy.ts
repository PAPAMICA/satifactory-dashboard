import { normalizeFrmBuildingClassName } from "@/lib/frmFactoryMapCategory";

/**
 * Bâtiments pour lesquels FRM `setEnabled` a un sens (production, générateurs, interrupteurs).
 * Exclut stockage / logistique pure (containers, trains, fondations, etc.).
 */
export function buildingClassSupportsSetEnabled(className: string): boolean {
  const cn = normalizeFrmBuildingClassName(className);
  if (!cn || cn === "—") return false;

  const deny =
    /StorageContainer|CentralStorage|FluidStorage|TrainDocking|TrainStation|Freight|TruckStation|DronePort|DroneStation|PipelinePump|PipelineJunction|ConveyorBelt|ConveyorLift|Splitter|Merger|PipelineSupport|Valve|Wall_|Floor_|Foundation|Ramp|Stair|Fence|Gate|Sign|Billboard|Beacon|JumpPad|HyperTube|PowerLine|Wire|Cable|Pole|Lights|WorkBench|LookoutTower|RadarTower|SpaceElevator|ResourceSink|TradingPost|HubTerminal|SpaceShip|Cart|Vehicle/i.test(
      cn,
    );
  if (deny) return false;

  const allow =
    /Build_(Constructor|Assembler|Manufacturer|Smelter|Foundry|Blender|Converter|Encoder|Packager|Particle|Refinery|OilRefinery|Generator|BiomassGenerator|CoalGenerator|FuelGenerator|NuclearGenerator|GeoThermal|PowerSwitch|PriorityPowerSwitch|Miner|PortableMiner|WaterPump|OilPump|Fracking|ResourceCollector)/i.test(
      cn,
    );
  if (allow) return true;

  if (/Build_Generator/i.test(cn)) return true;
  if (/Build_PriorityPowerSwitch|Build_PowerSwitch/i.test(cn)) return true;

  return /Build_(Manufacturer|Constructor|Assembler|Smelter|Blender|Converter|Encoder|Packager|Particle|Foundry|Refinery)/i.test(cn);
}

export function rowSupportsSetEnabled(row: Record<string, unknown>): boolean {
  const cn = String(row.ClassName ?? row.className ?? "").trim();
  return buildingClassSupportsSetEnabled(cn);
}
