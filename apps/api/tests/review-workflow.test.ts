import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgentMessage, OfficeEvent, OfficeTask } from '@jheckbot/shared'
import type { OfficeAgentMessageService } from '../src/services/OfficeAgentMessageService.js'
import type { OfficeEventService } from '../src/services/OfficeEventService.js'
import type { OfficeTaskService } from '../src/services/OfficeTaskService.js'
import { ReviewWorkflow, ReviewWorkflowError } from '../src/services/orchestration/ReviewWorkflow.js'

const AGENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function makeTask(overrides: Partial<OfficeTask> = {}): OfficeTask {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    officeId: 'office-1',
    title: 'Implement feature',
    status: 'working',
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeMessage(): OfficeAgentMessage {
  const now = new Date().toISOString()
  return {
    id: 'message-1',
    officeId: 'office-1',
    taskId: 'task-1',
    fromAgentId: AGENT_ID,
    type: 'FEEDBACK',
    content: 'Looks good.',
    createdAt: now,
  }
}

function makeEvent(eventType: string): OfficeEvent {
  return {
    id: 'event-1',
    officeId: 'office-1',
    eventType: eventType as OfficeEvent['eventType'],
    createdAt: new Date().toISOString(),
  }
}

describe('ReviewWorkflow', () => {
  let taskService: Pick<OfficeTaskService, 'getById' | 'setStatus'>
  let eventService: Pick<OfficeEventService, 'create'>
  let messageService: Pick<OfficeAgentMessageService, 'create'>
  let mockMessage: OfficeAgentMessage
  let workflow: ReviewWorkflow

  beforeEach(() => {
    mockMessage = makeMessage()

    taskService = {
      getById: vi.fn(),
      setStatus: vi.fn().mockImplementation((id, status) => {
        return Promise.resolve(makeTask({ id, status }))
      }),
    }

    eventService = {
      create: vi.fn().mockResolvedValue(makeEvent('TASK_REVIEW_STARTED')),
    }

    messageService = {
      create: vi.fn().mockResolvedValue(mockMessage),
    }

    workflow = new ReviewWorkflow(taskService, eventService, messageService)
  })

  describe('submitForReview', () => {
    it('transitions a working task to review and emits TASK_REVIEW_STARTED', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'working' }))

      const result = await workflow.submitForReview('task-1')

      expect(result.status).toBe('review')
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'review')
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'TASK_REVIEW_STARTED',
          metadata: expect.objectContaining({ taskId: 'task-1', previousStatus: 'working' }),
        }),
      )
    })

    it('rejects an empty task id', async () => {
      await expect(workflow.submitForReview('')).rejects.toThrow(ReviewWorkflowError)
      expect(taskService.getById).not.toHaveBeenCalled()
    })

    it('throws 404 when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(null)

      await expect(workflow.submitForReview('missing')).rejects.toThrow(ReviewWorkflowError)
    })

    it('throws 409 when the task is not in working status', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'qa' }))

      await expect(workflow.submitForReview('task-1')).rejects.toThrow(ReviewWorkflowError)
    })

    it('throws 500 when setStatus returns null', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'working' }))
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(null)

      await expect(workflow.submitForReview('task-1')).rejects.toThrow(ReviewWorkflowError)
    })
  })

  describe('approveReview', () => {
    it('transitions a review task to qa for medium workflows', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(
        makeTask({ status: 'review', workflowType: 'medium' }),
      )

      const result = await workflow.approveReview('task-1')

      expect(result.status).toBe('qa')
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'qa')
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'TASK_REVIEW_APPROVED',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            previousStatus: 'review',
            targetStatus: 'qa',
            workflowType: 'medium',
          }),
        }),
      )
    })

    it('transitions a review task to qa for complex workflows', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(
        makeTask({ status: 'review', workflowType: 'complex' }),
      )

      const result = await workflow.approveReview('task-1')

      expect(result.status).toBe('qa')
    })

    it('transitions a review task to completed for simple workflows', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(
        makeTask({ status: 'review', workflowType: 'simple' }),
      )

      const result = await workflow.approveReview('task-1')

      expect(result.status).toBe('completed')
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'completed')
    })

    it('defaults to qa for undefined workflow types', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'review' }))

      const result = await workflow.approveReview('task-1')

      expect(result.status).toBe('qa')
    })

    it('rejects an empty task id', async () => {
      await expect(workflow.approveReview('')).rejects.toThrow(ReviewWorkflowError)
    })

    it('throws 404 when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(null)

      await expect(workflow.approveReview('missing')).rejects.toThrow(ReviewWorkflowError)
    })

    it('throws 409 when the task is not in review status', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'working' }))

      await expect(workflow.approveReview('task-1')).rejects.toThrow(ReviewWorkflowError)
    })

    it('throws 500 when setStatus returns null', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'review' }))
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(null)

      await expect(workflow.approveReview('task-1')).rejects.toThrow(ReviewWorkflowError)
    })
  })

  describe('rejectReview', () => {
    it('transitions a review task to working and emits TASK_REVIEW_REJECTED', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'review' }))

      const result = await workflow.rejectReview('task-1', 'Needs refactoring')

      expect(result.status).toBe('working')
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'working')
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'TASK_REVIEW_REJECTED',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            reason: 'Needs refactoring',
          }),
        }),
      )
    })

    it('rejects an empty task id', async () => {
      await expect(workflow.rejectReview('')).rejects.toThrow(ReviewWorkflowError)
    })

    it('throws 404 when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(null)

      await expect(workflow.rejectReview('missing')).rejects.toThrow(ReviewWorkflowError)
    })

    it('throws 409 when the task is not in review status', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'qa' }))

      await expect(workflow.rejectReview('task-1')).rejects.toThrow(ReviewWorkflowError)
    })
  })

  describe('sendReviewFeedback', () => {
    it('creates a FEEDBACK agent message for the task', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'review' }))

      const result = await workflow.sendReviewFeedback('task-1', 'Fix the naming.', AGENT_ID)

      expect(result).toEqual(mockMessage)
      expect(messageService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          taskId: 'task-1',
          fromAgentId: AGENT_ID,
          type: 'FEEDBACK',
          content: 'Fix the naming.',
          metadata: { source: 'review' },
        }),
      )
    })

    it('rejects an empty task id', async () => {
      await expect(workflow.sendReviewFeedback('', 'Feedback', AGENT_ID)).rejects.toThrow(
        ReviewWorkflowError,
      )
    })

    it('rejects empty feedback content', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask())

      await expect(workflow.sendReviewFeedback('task-1', '   ', AGENT_ID)).rejects.toThrow(
        ReviewWorkflowError,
      )
    })

    it('requires a from agent id', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask())

      await expect(workflow.sendReviewFeedback('task-1', 'Feedback')).rejects.toThrow(
        ReviewWorkflowError,
      )
    })

    it('throws 404 when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(null)

      await expect(workflow.sendReviewFeedback('missing', 'Feedback', AGENT_ID)).rejects.toThrow(
        ReviewWorkflowError,
      )
    })
  })
})
