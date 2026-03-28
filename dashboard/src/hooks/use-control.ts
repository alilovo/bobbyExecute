'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { POLLING } from '@/lib/constants';
import type {
  DashboardLoginRequest,
  RestartAlertActionRequest,
  RestartAlertActionResponse,
  RestartAlertListResponse,
  RestartWorkerRequest,
  RestartWorkerResponse,
  DashboardOperatorAuthState,
  DashboardLoginResponse,
  DashboardLogoutResponse,
  WorkerRestartDeliveryQuery,
  WorkerRestartDeliveryJournalResponse,
  WorkerRestartDeliverySummaryResponse,
  WorkerRestartDeliveryTrendQuery,
  WorkerRestartDeliveryTrendResponse,
  LivePromotionDecisionBody,
  LivePromotionListResponse,
  LivePromotionRecord,
  LivePromotionRequestBody,
  LivePromotionTargetMode,
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

export function useOperatorSession() {
  return useQuery<DashboardOperatorAuthState>({
    queryKey: ['operator-session'],
    queryFn: api.operatorSession,
    refetchInterval: POLLING.CONTROL_STATUS,
    staleTime: POLLING.CONTROL_STATUS,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<DashboardLoginResponse, Error, DashboardLoginRequest>({
    mutationFn: api.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-session'] });
      queryClient.invalidateQueries({ queryKey: ['control-status'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<DashboardLogoutResponse, Error>({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-session'] });
      queryClient.invalidateQueries({ queryKey: ['control-status'] });
    },
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
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries-trends'] });
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
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries-trends'] });
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
      queryClient.invalidateQueries({ queryKey: ['restart-alert-deliveries-trends'] });
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

export function useRestartAlertDeliveryTrends(filters: WorkerRestartDeliveryTrendQuery = {}) {
  return useQuery<WorkerRestartDeliveryTrendResponse>({
    queryKey: ['restart-alert-deliveries-trends', filters],
    queryFn: () => api.restartAlertDeliveryTrends(filters),
    refetchInterval: POLLING.CONTROL_STATUS,
    staleTime: POLLING.CONTROL_STATUS,
  });
}

export function useLivePromotions(targetMode: LivePromotionTargetMode = 'live_limited') {
  return useQuery<LivePromotionListResponse>({
    queryKey: ['live-promotions', targetMode],
    queryFn: () => api.livePromotions(targetMode),
    refetchInterval: POLLING.CONTROL_STATUS,
    staleTime: POLLING.CONTROL_STATUS,
  });
}

function invalidateLivePromotionQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: ['live-promotions'] });
  queryClient.invalidateQueries({ queryKey: ['control-status'] });
}

export function useRequestLivePromotion() {
  const queryClient = useQueryClient();
  return useMutation<{ success: true; request: LivePromotionRecord }, Error, LivePromotionRequestBody>({
    mutationFn: api.requestLivePromotion,
    onSuccess: () => invalidateLivePromotionQueries(queryClient),
  });
}

export function useApproveLivePromotion() {
  const queryClient = useQueryClient();
  return useMutation<{ success: true; request: LivePromotionRecord }, Error, { id: string; input?: LivePromotionDecisionBody }>({
    mutationFn: ({ id, input }) => api.approveLivePromotion(id, input),
    onSuccess: () => invalidateLivePromotionQueries(queryClient),
  });
}

export function useDenyLivePromotion() {
  const queryClient = useQueryClient();
  return useMutation<{ success: true; request: LivePromotionRecord }, Error, { id: string; input?: LivePromotionDecisionBody }>({
    mutationFn: ({ id, input }) => api.denyLivePromotion(id, input),
    onSuccess: () => invalidateLivePromotionQueries(queryClient),
  });
}

export function useApplyLivePromotion() {
  const queryClient = useQueryClient();
  return useMutation<{ success: true; request: LivePromotionRecord }, Error, { id: string; input?: LivePromotionDecisionBody }>({
    mutationFn: ({ id, input }) => api.applyLivePromotion(id, input),
    onSuccess: () => invalidateLivePromotionQueries(queryClient),
  });
}

export function useRollbackLivePromotion() {
  const queryClient = useQueryClient();
  return useMutation<{ success: true; request: LivePromotionRecord }, Error, { id: string; input?: LivePromotionDecisionBody }>({
    mutationFn: ({ id, input }) => api.rollbackLivePromotion(id, input),
    onSuccess: () => invalidateLivePromotionQueries(queryClient),
  });
}
