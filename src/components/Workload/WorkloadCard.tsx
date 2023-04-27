import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Service, Workload } from "../../types";
import { Store } from "../../redux";
import WorkloadEditFormModal from "./WorkloadEdit";
import { Card, CardItem } from "../Generic/CardItem";
import {
  getWorkloadResourceConsumption,
  getWorkloadServices,
  removeWorkloadSafely,
} from "../../utils/workload";
import { launchModal } from "../Modals/Modals";

type WorkloadCardProps = {
  workload: Workload;
  disableActions?: boolean;
};

const getServiceDescription = (service: Service) => {
  const serviceName = service.name;
  const replicas = service.zones;

  let description = serviceName;
  if (replicas > 1) {
    description += `(X ${replicas} replicas)`;
  }
  return description;
};

const WorkloadCard: React.FC<WorkloadCardProps> = ({
  workload,
  disableActions,
}) => {
  const dispatch = useDispatch();
  const services = useSelector((store: Store) => store.service.services);
  const workloads = useSelector((store: Store) => store.workload).filter(
    (wl) => wl.duplicateOf === workload.id
  );

  const { totalMem, totalCPU } = getWorkloadResourceConsumption(
    workload,
    services
  );

  const removeWL = () => {
    const remover = removeWorkloadSafely(dispatch);
    remover(workload, services);
    workloads.forEach((wl) => remover(wl, services));
  };

  const workloadServices = getWorkloadServices(workload, services);

  const onEditClick = React.useCallback(() => {
    launchModal(WorkloadEditFormModal, { workload });
  }, [workload]);

  const usesMachines =
    workload.usesMachines.length > 0 ? workload.usesMachines.join(",") : null;

  const storageCapacityRequested = workload.storageCapacityRequired / 1024;

  return (
    <>
      <Card
        cardType="Workload"
        itemName={workload.name}
        itemId={workload.id}
        remove={removeWL}
        edit={onEditClick}
        disableActions={disableActions}
      >
        <CardItem title="Count" value={workload.count} />
        <CardItem title="CPU" value={`${totalCPU} units`} />
        <CardItem title="Memory Used" value={`${totalMem} GB`} />
        <CardItem
          title="Services"
          value={workloadServices.map(getServiceDescription).join(", ")}
        />
        {usesMachines && (
          <CardItem title="Uses Machines" value={usesMachines} />
        )}
        {workload.storageCapacityRequired !== 0 && (
          <CardItem
            title="Storage Capacity requested"
            value={`${storageCapacityRequested.toFixed(3)} TB`}
          />
        )}
      </Card>
    </>
  );
};

export default WorkloadCard;
