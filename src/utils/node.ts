import { Service, Workload, Zone } from "../types";
import { Node } from "../types";
import * as _ from "lodash";
import {
  canNodeSupportRequirements,
  getTotalResourceRequirement,
} from "./common";

/**
 *
 * @param node The node where the service needs to be added
 * @param candidate Service we want to add to this node
 * @param allServices All the service objects (required as Node only tracks the service)
 * @returns
 */
export const canNodeAddService = (
  node: Node,
  candidate: Service,
  allServices: Service[],
  workloads: Workload[]
): boolean => {
  const currentWorkload: Workload = workloads.find((workload) =>
    workload.services.includes(candidate.id)
  );
  // Check if the workload is meant to run on a particular node
  if (
    !_.isEmpty(currentWorkload.usesMachines) &&
    !currentWorkload.usesMachines.includes(node.machineSet)
  ) {
    return false;
  }

  // Check if node is tainited
  if (
    !_.isEmpty(node.onlyFor) &&
    !node.onlyFor.includes(currentWorkload.name)
  ) {
    return false;
  }

  const { services: existingServicesIds }: Node = node;
  // Get all the service objects from the ids
  const existingServices = allServices.filter((service) =>
    existingServicesIds.includes(service.id)
  );

  // Does the candidate avoid any of the preexisting service
  if (_.intersection(candidate.avoid, existingServicesIds).length > 0) {
    return false;
  }

  // Does the avoid of any of the existing services contain the candiate
  const existingAvoids = _.flatten(
    existingServices.map((service) => service.avoid)
  );
  if (_.intersection([candidate.id], existingAvoids).length > 0) {
    return false;
  }

  // Resource Calculation
  // Check if the node can handle resource requirements
  const nodeResourceConsumption = getTotalResourceRequirement(existingServices);

  // Important: Scheduler should always schedule coplaced services together
  const coplacedServices = allServices.filter((service) =>
    candidate.runsWith.includes(service.id)
  );
  const adjustedCandidates = [...coplacedServices, candidate];
  return canNodeSupportRequirements(
    getTotalResourceRequirement(adjustedCandidates),
    nodeResourceConsumption,
    node
  );
};

export const getTotalNodeMemoryConsumption = (
  node: Node,
  services: Service[]
): number => {
  const nodeServices = getServicesInNode(node, services);
  return getTotalResourceRequirement(nodeServices).totalMem;
};

// export const getMachineSetNodes = (machineSet: string, nodes: Node[]): Node[] =>
//   nodes.filter((node) => machineSet === node.machineSet);

// export const getSuitableNodesFor = (
//   workload: Workload,
//   nodes: Node[],
//   machineSets: MachineSet[]
// ): Node[] => {
//   const usableMS = machineSets.filter((ms) =>
//     ms.onlyFor.length > 0 ? ms.onlyFor.includes(workload.name) : true
//   );
//   return _.flatten(usableMS.map((ms) => getMachineSetNodes(ms.name, nodes)));
// };

// const getNodeOfMachineSet = (machineset: MachineSet): Node => ({
//   id: getNodeID(),
//   maxDisks: machineset.numberOfDisks,
//   cpuUnits: machineset.cpu,
//   memory: machineset.memory,
//   machineSet: machineset.name,
//   services: [],
// });

// export const getNodeForWorkload = (
//   workload: Workload,
//   machineSet: MachineSet[]
// ): Node => {
//   const dedicatedMS = workload.usesMachines;
//   const candidateMS =
//     dedicatedMS.length > 0
//       ? machineSet.filter((ms) => dedicatedMS.includes(ms.name))
//       : machineSet.filter((ms) => ms.name === "default");
//   const usingMS = candidateMS[0];
//   return getNodeOfMachineSet(usingMS);
// };

export const getMaxZones = (services: Service[]): number =>
  _.max(services.map((service) => service.zones));

export const getServicesInNode = (node: Node, services: Service[]): Service[] =>
  services.filter((service) => node.services.includes(service.id));

export const getOSDsInNode = (node: Node, services: Service[]): number => {
  const nodeServices = getServicesInNode(node, services);
  return nodeServices.filter((service) =>
    service.name.toUpperCase().includes("OSD")
  ).length;
};

export const sortBestZones = (
  zones: Zone[],
  nodes: Node[],
  allServices: Service[],
  workload: Service[]
): Zone[] => {
  const requirements = getTotalResourceRequirement(workload);

  const suitableZones = [];

  zones.forEach((zone) => {
    const nodesInZone = nodes.filter((node) => zone.nodes.includes(node.id));
    const nodesThatCanSupport = nodesInZone.filter((node) => {
      const servicesInNode = allServices.filter((s) =>
        node.services.includes(s.id)
      );
      const currentNodeUsage = getTotalResourceRequirement(servicesInNode);
      return canNodeSupportRequirements(requirements, currentNodeUsage, node);
    });
    if (nodesThatCanSupport.length > 0) {
      suitableZones.push({ zone, freeNodes: nodesThatCanSupport.length });
    }
  });

  suitableZones.sort((a, b) => {
    const diff = b.freeNodes - a.freeNodes;
    if (diff === 0) {
      return b.zone.id - a.zone.id;
    }
    return diff;
  });
  return suitableZones.map((sZ) => sZ.zone);
};
