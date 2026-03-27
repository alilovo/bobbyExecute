'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { POLLING } from '@/lib/constants';
import type {
  RestartAlertActionRequest,
  RestartAlertActionResponse,
  RestartAlertListResponse,
  RestartWorkerRequest,
  RestartWorkerResponse,
  WorkerRestartDeliveryQuery,
  WorkerRestartDeliveryJournalResponse,
  WorkerRestartDeliverySummaryResponse,
} from '@/types/api';

export function useEmergencyStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.emergencyStop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['control-status'] });
    },
  });
}

export function useResetKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.reset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['control-status'] });
    },
  });
}

export function useControlStatus() {
  return useQuery({
    queryKey: ['control-status'],
    queryFn: api.controlStatus,
    refetchInterval: POLLING.CONTROL_STATUS,
    staleTime: POLLING.CONTROL_STATUS,
  });
}

export function useRestartAlerts() {
  return useQuery<RestartAlertListResponse>({
    queryKey: ['restart-alerts'],
    queryFn: api.restartAlerts,
    refetchInterval: POLLING.CONTROL_STATUS,
    staleTime: POLLING.CONTROL_STATUS,
  });
}

export function useRestartWorker() {
  const queryClient = useQueryClient();
  return useMutation<RestartWorkerResponse, Error, RestartWorkerRequest>({
    mutationFn: (input: RestartWorkerRequest) => api.restartWorker(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-status'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries-summary'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

export function useAcknowledgeRestartAlert() {
  const queryClient = useQueryClient();
  return useMutation<RestartAlertActionResponse, Error, { id: string; input?: RestartAlertActionRequest }>({
    mutationFn: ({ id, input }) => api.acknowledgeRestartAlert(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-status'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries-summary'] });
    },
  });
}

export function useResolveRestartAlert() {
  const queryClient = useQueryClient();
  return useMutation<RestartAlertActionResponse, Error, { id: string; input?: RestartAlertActionRequest }>({
    mutationFn: ({ id, input }) => api.resolveRestartAlert(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-status'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries-summary'] });
    },
  });
}

export function useRestartAlertDeliveries(filters: WorkerRestartDeliveryQuery = {}) {
  return useQuery<WorkerRestartDeliveryJournalResponse>({
    queryKey: ['restart-alert-deliveries', filters],
    queryFn: () => api.restartAlertDeliveries(filters),
    refetchInterval: POLLING.CONTROL_STATUS,
    staleTime: POLLING.CONTROL_STATUS,
  });
}

export function useRestartAlertDeliverySummary(filters: WorkerRestartDeliveryQuery = {}) {
  return useQuery<WorkerRestartDeliverySummaryResponse>({
    queryKey: ['restart-alert-deliveries-summary', filters],
    queryFn: () => api.restartAlertDeliverySummary(filters),
    refetchInterval: POLLING.CONTROL_STATUS,
    staleTime: POLLING.CONTROL_STATUS,
  });
}
