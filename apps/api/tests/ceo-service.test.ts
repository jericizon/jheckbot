import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Office } from '@jheckbot/shared'
import type { CEOPlan, CEOPlanner } from '../src/services/orchestration/CEOPlanner.js'
import type { OfficeEventService } from '../src/services/OfficeEventService.js'
import type { OfficeTaskExecutionResult, OfficeTaskExecutionService } from '../src/services/orchestration/OfficeTaskExecutionService.js'
import type { OfficeTaskService } from '../src/services/OfficeTaskService.js'
import type { OfficeRepository } from '../src/repositories/OfficeRepository.js'
import type { ProjectService } from '../src/services/ProjectService.js'
import type { ProjectRecord } from '../src/repositories/ProjectRepository.js'
import { CEOService, CEOServiceError } from '../src/services/orchestration/CEOService.js'

const officeId = '00000000-0000-0000-0000-000000000001'
const projectId = '11111111-1111-1111-1111-111111111111'
const taskId = '22222222-2222-2222-2222-222222222222'
const conversationId = '33333333-3333-3333-3333-333333333333'
const agentId = '44444444-4444-4444-4444-444444444444'

function makePlan(): CEOPlan {
  return {
    request: 'Add login',
    complexity: 'simple',
    tasks: [
      {
        id: taskId,
        officeId,
        projectId,
        title: 'Implement Add login',
        status: 'backlog',
        priority: 'low',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    dependencies: [],
  }
}

function makeOffice(overrides: Partial<Office> = {}): Office {
  return {
    id: officeId,
    name: 'Test Office',
    projectId,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeProject(enabled = true): ProjectRecord {
  return {
    id: projectId,
    name: 'Test Project',
    slug: 'test',
    path: '/tmp/test',
    description: null,
    enabled,
    default_provider_id: 'devin',
    default_provider_config: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function makeExecution(overrides: Partial<OfficeTaskExecutionResult> = {}): OfficeTaskExecutionResult {
  return {
    taskId,
    conversationId,
    agentId,
    status: 'started',
    ...overrides,
  }
}

function makeEvent(eventType: string, content: string): any {
  return {
    id: 'event-1',
    officeId,
    eventType,
    content,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

describe('CEOService', () => {
  let planner: Pick<CEOPlanner, 'planSingleTask'>
  let eventService: Pick<OfficeEventService, 'create' | 'listByOfficeAndTypes'>
  let executionService: Pick<OfficeTaskExecutionService, 'start'>
  let taskService: Pick<OfficeTaskService, 'findActiveCeoExecution'>
  let officeRepo: Pick<OfficeRepository, 'findById'>
  let projectService: Pick<ProjectService, 'get'>
  let service: CEOService

  beforeEach(() => {
    planner = {
      planSingleTask: vi.fn().mockResolvedValue(makePlan()),
    } as unknown as Pick<CEOPlanner, 'planSingleTask'>
    eventService = {
      create: vi.fn().mockResolvedValue(makeEvent('CEO_RESPONSE', 'I have a plan')),
      listByOfficeAndTypes: vi.fn().mockResolvedValue([]),
    } as unknown as Pick<OfficeEventService, 'create' | 'listByOfficeAndTypes'>
    executionService = {
      start: vi.fn().mockResolvedValue(makeExecution()),
    } as unknown as Pick<OfficeTaskExecutionService, 'start'>
    taskService = {
      findActiveCeoExecution: vi.fn().mockResolvedValue(null),
    } as unknown as Pick<OfficeTaskService, 'findActiveCeoExecution'>
    officeRepo = {
      findById: vi.fn().mockResolvedValue(makeOffice()),
    } as unknown as Pick<OfficeRepository, 'findById'>
    projectService = {
      get: vi.fn().mockResolvedValue(makeProject()),
    } as unknown as Pick<ProjectService, 'get'>

    service = new CEOService({
      planner: planner as CEOPlanner,
      eventService: eventService as OfficeEventService,
      executionService: executionService as OfficeTaskExecutionService,
      taskService: taskService as OfficeTaskService,
      officeRepo: officeRepo as OfficeRepository,
      projectService: projectService as ProjectService,
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a message and returns a single task with execution summary', async () => {
    const expectedPlan = makePlan()
    const expectedExecution = makeExecution()
    vi.mocked(planner.planSingleTask).mockResolvedValueOnce(expectedPlan)
    vi.mocked(executionService.start).mockResolvedValueOnce(expectedExecution)
    vi.mocked(eventService.create)
      .mockResolvedValueOnce(makeEvent('CEO_MESSAGE', 'Add login'))
      .mockResolvedValueOnce(makeEvent('CEO_RESPONSE', 'I have a plan'))

    const result = await service.sendMessage({ officeId, request: 'Add login' })

    expect(officeRepo.findById).toHaveBeenCalledWith(officeId)
    expect(projectService.get).toHaveBeenCalledWith(projectId)
    expect(taskService.findActiveCeoExecution).toHaveBeenCalledWith(officeId)
    expect(planner.planSingleTask).toHaveBeenCalledWith('Add login', officeId, projectId)
    expect(executionService.start).toHaveBeenCalledWith(taskId, { model: undefined })
    expect(result.plan).toEqual(expectedPlan)
    expect(result.execution).toEqual(expectedExecution)
    expect(eventService.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventType: 'CEO_RESPONSE' }),
    )
  })

  it('throws for missing office id', async () => {
    await expect(service.sendMessage({ officeId: '', request: 'Add login' })).rejects.toBeInstanceOf(CEOServiceError)
  })

  it('throws for empty request', async () => {
    await expect(service.sendMessage({ officeId, request: '' })).rejects.toBeInstanceOf(CEOServiceError)
  })

  it('throws 404 when office does not exist', async () => {
    vi.mocked(officeRepo.findById).mockResolvedValueOnce(null)
    await expect(service.sendMessage({ officeId, request: 'Add login' })).rejects.toMatchObject({
      message: 'Office not found',
      statusCode: 404,
    })
  })

  it('throws 404 when project does not exist', async () => {
    vi.mocked(projectService.get).mockResolvedValueOnce(null)
    await expect(service.sendMessage({ officeId, request: 'Add login' })).rejects.toMatchObject({
      message: 'Project not found',
      statusCode: 404,
    })
  })

  it('throws 400 when project is disabled', async () => {
    vi.mocked(projectService.get).mockResolvedValueOnce(makeProject(false))
    await expect(service.sendMessage({ officeId, request: 'Add login' })).rejects.toMatchObject({
      message: 'Project is disabled',
      statusCode: 400,
    })
  })

  it('throws 409 when an active CEO execution already exists', async () => {
    vi.mocked(taskService.findActiveCeoExecution).mockResolvedValueOnce(makePlan().tasks[0])
    await expect(service.sendMessage({ officeId, request: 'Add login' })).rejects.toMatchObject({
      message: 'An active CEO execution is already in progress',
      statusCode: 409,
    })
  })

  it('rejects a project id that does not match the office', async () => {
    await expect(service.sendMessage({ officeId, request: 'Add login', projectId: 'other-project' })).rejects.toMatchObject({
      message: 'Project ID does not match office project',
      statusCode: 400,
    })
  })

  it('passes a model to the execution service', async () => {
    vi.mocked(eventService.create)
      .mockResolvedValueOnce(makeEvent('CEO_MESSAGE', 'Add login'))
      .mockResolvedValueOnce(makeEvent('CEO_RESPONSE', 'I have a plan'))

    await service.sendMessage({ officeId, request: 'Add login', model: 'devin-pro' })

    expect(executionService.start).toHaveBeenCalledWith(taskId, { model: 'devin-pro' })
  })

  it('returns execution failure in the summary when devin could not start', async () => {
    vi.mocked(eventService.create)
      .mockResolvedValueOnce(makeEvent('CEO_MESSAGE', 'Add login'))
      .mockResolvedValueOnce(makeEvent('CEO_RESPONSE', 'I have a plan'))
    vi.mocked(executionService.start).mockResolvedValueOnce(makeExecution({ status: 'failed', error: 'devin_start_failed' }))

    const result = await service.sendMessage({ officeId, request: 'Add login' })

    expect(result.execution.status).toBe('failed')
    expect(result.execution.error).toBe('devin_start_failed')
  })

  it('lists conversation events filtered by type', async () => {
    await service.listConversationEvents(officeId)
    expect(eventService.listByOfficeAndTypes).toHaveBeenCalledWith(officeId, [
      'CEO_MESSAGE',
      'CEO_RESPONSE',
      'CEO_PLANNING',
    ])
  })
})
