import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficeAgentMessage, OfficeEvent, OfficeTask } from '@jheckbot/shared'
import type { OfficeAgentMessageService } from '../src/services/OfficeAgentMessageService.js'
import type { OfficeEventService } from '../src/services/OfficeEventService.js'
import type { OfficeTaskService } from '../src/services/OfficeTaskService.js'
import { QAWorkflow, QAWorkflowError } from '../src/services/orchestration/QAWorkflow.js'

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

describe('QAWorkflow', () => {
  let taskService: Pick<OfficeTaskService, 'getById' | 'setStatus'>
  let eventService: Pick<OfficeEventService, 'create'>
  let messageService: Pick<OfficeAgentMessageService, 'create'>
  let mockMessage: OfficeAgentMessage
  let workflow: QAWorkflow

  beforeEach(() => {
    mockMessage = makeMessage()

    taskService = {
      getById: vi.fn(),
      setStatus: vi.fn().mockImplementation((id, status) => {
        return Promise.resolve(makeTask({ id, status }))
      }),
    }

    eventService = {
      create: vi.fn().mockResolvedValue(makeEvent('TASK_QA_STARTED')),
    }

    messageService = {
      create: vi.fn().mockResolvedValue(mockMessage),
    }

    workflow = new QAWorkflow(taskService, eventService, messageService)
  })

  describe('submitForQA', () => {
    it('transitions a working task to qa and emits TASK_QA_STARTED', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'working' }))

      const result = await workflow.submitForQA('task-1')

      expect(result.status).toBe('qa')
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'qa')
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'TASK_QA_STARTED',
          metadata: expect.objectContaining({ taskId: 'task-1', previousStatus: 'working' }),
        }),
      )
    })

    it('rejects an empty task id', async () => {
      await expect(workflow.submitForQA('')).rejects.toThrow(QAWorkflowError)
      expect(taskService.getById).not.toHaveBeenCalled()
    })

    it('throws 404 when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(null)

      await expect(workflow.submitForQA('missing')).rejects.toThrow(QAWorkflowError)
      expect(taskService.setStatus).not.toHaveBeenCalled()
    })

    it('throws 409 when the task is not in working status', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'review' }))

      await expect(workflow.submitForQA('task-1')).rejects.toThrow(QAWorkflowError)
      expect(taskService.setStatus).not.toHaveBeenCalled()
    })

    it('throws 500 when setStatus returns null', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'working' }))
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(null)

      await expect(workflow.submitForQA('task-1')).rejects.toThrow(QAWorkflowError)
    })
  })

  describe('approveQA', () => {
    it('transitions a qa task to testing for medium workflows', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(
        makeTask({ status: 'qa', workflowType: 'medium' }),
      )

      const result = await workflow.approveQA('task-1')

      expect(result.status).toBe('testing')
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'testing')
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'TASK_QA_APPROVED',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            previousStatus: 'qa',
            targetStatus: 'testing',
            workflowType: 'medium',
          }),
        }),
      )
    })

    it('transitions a qa task to testing for complex workflows', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(
        makeTask({ status: 'qa', workflowType: 'complex' }),
      )

      const result = await workflow.approveQA('task-1')

      expect(result.status).toBe('testing')
    })

    it('transitions a qa task to completed for simple workflows', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(
        makeTask({ status: 'qa', workflowType: 'simple' }),
      )

      const result = await workflow.approveQA('task-1')

      expect(result.status).toBe('completed')
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'completed')
    })

    it('defaults to completed for undefined workflow types', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'qa' }))

      const result = await workflow.approveQA('task-1')

      expect(result.status).toBe('completed')
    })

    it('rejects an empty task id', async () => {
      await expect(workflow.approveQA('')).rejects.toThrow(QAWorkflowError)
    })

    it('throws 404 when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(null)

      await expect(workflow.approveQA('missing')).rejects.toThrow(QAWorkflowError)
    })

    it('throws 409 when the task is not in qa status', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'working' }))

      await expect(workflow.approveQA('task-1')).rejects.toThrow(QAWorkflowError)
    })

    it('throws 500 when setStatus returns null', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'qa' }))
      vi.mocked(taskService.setStatus).mockResolvedValueOnce(null)

      await expect(workflow.approveQA('task-1')).rejects.toThrow(QAWorkflowError)
    })
  })

  describe('rejectQA', () => {
    it('transitions a qa task to failed and emits TASK_QA_REJECTED', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'qa' }))

      const result = await workflow.rejectQA('task-1', 'Tests failed')

      expect(result.status).toBe('failed')
      expect(taskService.setStatus).toHaveBeenCalledWith('task-1', 'failed')
      expect(eventService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          eventType: 'TASK_QA_REJECTED',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            reason: 'Tests failed',
          }),
        }),
      )
    })

    it('rejects an empty task id', async () => {
      await expect(workflow.rejectQA('')).rejects.toThrow(QAWorkflowError)
    })

    it('throws 404 when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(null)

      await expect(workflow.rejectQA('missing')).rejects.toThrow(QAWorkflowError)
    })

    it('throws 409 when the task is not in qa status', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'working' }))

      await expect(workflow.rejectQA('task-1')).rejects.toThrow(QAWorkflowError)
    })
  })

  describe('sendQAFeedback', () => {
    it('creates a FEEDBACK agent message for the task', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask({ status: 'qa' }))

      const result = await workflow.sendQAFeedback('task-1', 'Fix the edge case.', AGENT_ID)

      expect(result).toEqual(mockMessage)
      expect(messageService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: 'office-1',
          taskId: 'task-1',
          fromAgentId: AGENT_ID,
          type: 'FEEDBACK',
          content: 'Fix the edge case.',
          metadata: { source: 'qa' },
        }),
      )
    })

    it('rejects an empty task id', async () => {
      await expect(workflow.sendQAFeedback('', 'Feedback', AGENT_ID)).rejects.toThrow(
        QAWorkflowError,
      )
    })

    it('rejects empty feedback content', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask())

      await expect(workflow.sendQAFeedback('task-1', '   ', AGENT_ID)).rejects.toThrow(
        QAWorkflowError,
      )
    })

    it('requires a from agent id', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(makeTask())

      await expect(workflow.sendQAFeedback('task-1', 'Feedback')).rejects.toThrow(QAWorkflowError)
    })

    it('throws 404 when the task is not found', async () => {
      vi.mocked(taskService.getById).mockResolvedValue(null)

      await expect(workflow.sendQAFeedback('missing', 'Feedback', AGENT_ID)).rejects.toThrow(
        QAWorkflowError,
      )
    })
  })
})
