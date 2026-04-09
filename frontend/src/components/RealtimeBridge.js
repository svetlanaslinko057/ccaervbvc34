import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeEvents, useRealtimeSetup } from '../hooks/useRealtime';
import { useToast } from './Toast';

/**
 * Executor Realtime Bridge
 * Handles real-time events for developers with action buttons
 */
export function ExecutorRealtimeBridge({ userId, onRefresh }) {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Setup rooms
  useRealtimeSetup(userId, 'developer');

  // Handle events
  useRealtimeEvents({
    'workunit.assigned': (payload) => {
      toast.success('New task assigned', {
        description: payload.title || 'A new task is waiting for you',
        actionLabel: 'View Task',
        onAction: () => navigate(`/developer/work/${payload.unit_id}`),
      });
      onRefresh?.();
    },
    
    'workunit.revision_requested': (payload) => {
      toast.error('Revision required', {
        description: payload.title || 'Your submission needs changes',
        actionLabel: 'View Feedback',
        onAction: () => navigate(`/developer/work/${payload.unit_id}`),
      });
      onRefresh?.();
    },
    
    'submission.reviewed': (payload) => {
      if (payload.result === 'approved') {
        toast.success('Task approved!', {
          description: payload.feedback || 'Great work! Moving to validation.',
        });
      } else {
        toast.warning('Changes requested', {
          description: payload.feedback || 'Please review the feedback',
          actionLabel: 'View Details',
          onAction: () => navigate(`/developer/work/${payload.unit_id}`),
        });
      }
      onRefresh?.();
    },
  });

  return null;
}

/**
 * Tester Realtime Bridge
 */
export function TesterRealtimeBridge({ userId, onRefresh }) {
  const { toast } = useToast();
  const navigate = useNavigate();

  useRealtimeSetup(userId, 'tester');

  useRealtimeEvents({
    'validation.created': (payload) => {
      toast.warning('New validation task', {
        description: payload.title || 'A task is ready for testing',
        actionLabel: 'Start Testing',
        onAction: () => navigate(`/tester/validation/${payload.validation_id}`),
      });
      onRefresh?.();
    },
    
    'validation.reopened': (payload) => {
      toast.info('Validation reopened', {
        description: 'Task has been resubmitted for testing',
        actionLabel: 'Review',
        onAction: () => navigate(`/tester/validation/${payload.validation_id}`),
      });
      onRefresh?.();
    },
  });

  return null;
}

/**
 * Client Realtime Bridge
 */
export function ClientRealtimeBridge({ userId, projectIds = [], onRefresh }) {
  const { toast } = useToast();
  const navigate = useNavigate();

  useRealtimeSetup(userId, 'client', projectIds.map(id => `project:${id}`));

  useRealtimeEvents({
    'deliverable.created': (payload) => {
      toast.success('New deliverable ready!', {
        description: `${payload.title || 'Delivery'} ${payload.version || ''} is ready for review`,
        actionLabel: 'Review Delivery',
        onAction: () => navigate(`/client/deliverable/${payload.deliverable_id}`),
        duration: 8000, // Longer duration for important event
      });
      onRefresh?.();
    },
    
    'project.updated': (payload) => {
      toast.info('Project updated', {
        description: payload.message || `${payload.name || 'Your project'} has been updated`,
        actionLabel: 'View Project',
        onAction: () => navigate(`/client/project/${payload.project_id}`),
      });
      onRefresh?.();
    },
    
    'project.stage_changed': (payload) => {
      toast.success('Project milestone', {
        description: `Project moved to ${payload.stage} stage`,
        actionLabel: 'View Timeline',
        onAction: () => navigate(`/client/project/${payload.project_id}`),
      });
      onRefresh?.();
    },
    
    'support.updated': (payload) => {
      toast.info('Support response', {
        description: 'Your support ticket has been updated',
        actionLabel: 'View Response',
        onAction: () => navigate('/client/support'),
      });
      onRefresh?.();
    },
  });

  return null;
}

/**
 * Admin Realtime Bridge
 */
export function AdminRealtimeBridge({ userId, onRefresh }) {
  const { toast } = useToast();
  const navigate = useNavigate();

  useRealtimeSetup(userId, 'admin');

  useRealtimeEvents({
    'submission.created': (payload) => {
      toast.warning('New submission', {
        description: `${payload.title || 'Task'} submitted for review`,
        actionLabel: 'Review Now',
        onAction: () => navigate('/admin/control-center'),
      });
      onRefresh?.();
    },
    
    'validation.failed': (payload) => {
      toast.error('Validation failed', {
        description: payload.title || 'A task failed QA validation',
        actionLabel: 'View Details',
        onAction: () => navigate('/admin/control-center'),
      });
      onRefresh?.();
    },
    
    'validation.passed': (payload) => {
      toast.success('Validation passed', {
        description: payload.title || 'Task passed QA',
      });
      onRefresh?.();
    },
    
    'alert.created': (payload) => {
      toast.error('System Alert', {
        description: payload.message || 'Critical issue detected',
        actionLabel: 'Investigate',
        onAction: () => navigate('/admin/control-center'),
        duration: 10000, // Critical - longer duration
      });
      onRefresh?.();
    },
    
    'project.risk_changed': (payload) => {
      if (payload.risk === 'high') {
        toast.error('High risk project', {
          description: `${payload.name || 'Project'} needs attention`,
          actionLabel: 'View Project',
          onAction: () => navigate(`/admin/project/${payload.project_id}`),
        });
      }
      onRefresh?.();
    },
  });

  return null;
}

export default ExecutorRealtimeBridge;
