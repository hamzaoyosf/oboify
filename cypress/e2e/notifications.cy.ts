describe('Unified Notification Radar & Alerts', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.window().then((win) => {
      win.sessionStorage.clear()
    })
  })

  it('shows Mind Clear empty state when no urgent tasks exist', () => {
    // 1. Sign in via Google Auth
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // 2. Notification badge should NOT exist when there are no overdue/due tasks
    cy.get('[data-testid="notification-badge"]').should('not.exist')

    // 3. Open notifications dropdown from sidebar bell
    cy.get('aside').find('button[aria-label^="Notifications"]').click()

    // 4. Verify empty state text
    cy.contains('Mind Clear - No active alerts.').should('be.visible')
    cy.contains('All tasks are currently on track.').should('be.visible')
  })

  it('displays red badge and urgent task alert with Schedule & Focus Now buttons', () => {
    const overdueTask = {
      id: 'tsk_test_overdue',
      title: 'Review Quarterly Budget Report',
      notes: '',
      status: 'in_progress',
      gtdList: 'next',
      quadrant: null,
      priority: 'high',
      dueDate: '2026-10-19',
      scheduledDate: '2026-10-19',
      estimateMin: 45,
      context: ['@computer'],
      tags: ['finance'],
      subtasks: [],
      order: 1000,
      createdAt: '2026-10-19T08:00:00.000Z',
      updatedAt: '2026-10-19T08:00:00.000Z',
      schemaVersion: 1,
    }

    // Seed overdue task into LocalStorage before navigating to app
    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([overdueTask]))
    })

    // 1. Visit app and sign in
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // 2. Strict red badge must appear with count 1
    cy.get('[data-testid="notification-badge"]')
      .should('be.visible')
      .and('contain', '1')
      .and('have.class', 'bg-red-500')

    // 3. Click notification bell
    cy.get('aside').find('button[aria-label^="Notifications"]').click()

    // 4. Dropdown opens with alert item
    cy.contains('Unified Radar').should('be.visible')
    cy.contains('Review Quarterly Budget Report').should('be.visible')
    cy.contains('Overdue (2026-10-19)').should('be.visible')
    cy.contains('Schedule').should('be.visible')
    cy.contains('Focus Now').should('be.visible')

    // 5. Clicking Focus Now redirects to Action Hub
    cy.contains('Focus Now').click()
    cy.url().should('include', '/app/action')
  })

  it('clicking Schedule closes dropdown, activates Timeline view, and prioritizes & highlights task at top', () => {
    const overdueTask = {
      id: 'tsk_test_overdue_timeline',
      title: 'Prepare Board Pitch Deck',
      notes: '',
      status: 'in_progress',
      gtdList: 'next',
      quadrant: null,
      priority: 'high',
      dueDate: '2026-10-18',
      scheduledDate: '2026-10-18',
      estimateMin: 60,
      context: ['@work'],
      tags: ['pitch'],
      subtasks: [],
      order: 1000,
      createdAt: '2026-10-18T08:00:00.000Z',
      updatedAt: '2026-10-18T08:00:00.000Z',
      schemaVersion: 1,
    }

    const otherTask = {
      id: 'tsk_test_other_earlier',
      title: 'AAA Early Alphabetical Task',
      notes: '',
      status: 'in_progress',
      gtdList: 'next',
      quadrant: null,
      priority: 'low',
      dueDate: null,
      scheduledDate: null,
      estimateMin: 15,
      context: [],
      tags: [],
      subtasks: [],
      order: 10,
      createdAt: '2026-10-18T07:00:00.000Z',
      updatedAt: '2026-10-18T07:00:00.000Z',
      schemaVersion: 1,
    }

    // Seed tasks
    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([otherTask, overdueTask]))
    })

    // Sign in and go to app
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // Open notifications
    cy.get('aside').find('button[aria-label^="Notifications"]').click()
    cy.contains('Prepare Board Pitch Deck').should('be.visible')

    // Click Schedule button
    cy.contains('Schedule').click()

    // 1. Dropdown auto-closes
    cy.contains('Unified Radar').should('not.exist')

    // 2. URL reflects view=timeline and highlight parameter
    cy.url().should('include', '/app/action?view=timeline&highlight=tsk_test_overdue_timeline')

    // 3. ActionHub renders Timeline view
    cy.contains('Unscheduled Tasks').should('be.visible')

    // 4. Highlighted card is visible with glowing style and forced to top
    cy.get('[data-testid="highlighted-task-card"]')
      .should('be.visible')
      .and('contain', 'Prepare Board Pitch Deck')
      .and('have.class', 'ring-2')
      .and('have.class', 'animate-pulse')

    // The first card in unscheduled list must be the highlighted task
    cy.get('[data-testid="highlighted-task-card"]')
      .parent()
      .children()
      .first()
      .should('contain', 'Prepare Board Pitch Deck')
  })

  it('renders cross-day midnight overflow block at 00:00 on current day grid with adjusted remainder duration', () => {
    const now = new Date()
    const todayYear = now.getFullYear()
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0')
    const todayDay = String(now.getDate()).padStart(2, '0')
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yYear = yesterday.getFullYear()
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0')
    const yDay = String(yesterday.getDate()).padStart(2, '0')
    const yesterdayStr = `${yYear}-${yMonth}-${yDay}`

    // Block scheduled yesterday at 23:45 with 30m duration (ends at 00:15 today)
    const crossoverBlock = {
      id: 'blk_crossover_midnight',
      title: 'Midnight Cross-Day Sync',
      category: 'deep_work',
      color: 'cyan',
      start: `${yesterdayStr}T23:45:00.000Z`,
      end: `${todayStr}T00:15:00.000Z`,
      taskId: null,
      source: 'OBOiFY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:timeBlocks', JSON.stringify([crossoverBlock]))
    })

    // Sign in and navigate directly to Timeline view
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // Verify the overflow block renders at 00:00 on today's grid
    cy.contains('Midnight Cross-Day Sync').should('be.visible')
    cy.get('[data-testid="crossover-badge"]').should('be.visible').and('contain', 'Rollover')
    cy.contains('(rollover)').should('be.visible')

    // Verify it is positioned at the top of the grid (topPx == 0)
    cy.contains('Midnight Cross-Day Sync')
      .closest('.absolute.rounded-xl')
      .should('have.attr', 'style')
      .and('include', 'top: 0px')
  })

  it('renders subtle red left-border on TimeBlock for overdue scheduled tasks while keeping background Zen', () => {
    const now = new Date()
    const todayYear = now.getFullYear()
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0')
    const todayDay = String(now.getDate()).padStart(2, '0')
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`

    // Overdue task from 2026-10-18
    const overdueTask = {
      id: 'tsk_overdue_scheduled',
      title: 'Tax Filing Review Session',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'high',
      dueDate: '2026-10-18',
      scheduledDate: '2026-10-18',
      estimateMin: 60,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: '2026-10-18T08:00:00.000Z',
      updatedAt: '2026-10-18T08:00:00.000Z',
      schemaVersion: 1,
    }

    // Block scheduled on today's grid linked to the overdue task
    const overdueScheduledBlock = {
      id: 'blk_overdue_scheduled',
      title: 'Tax Filing Review Session',
      category: 'deep_work',
      color: 'cyan',
      start: `${todayStr}T10:00:00.000Z`,
      end: `${todayStr}T11:00:00.000Z`,
      taskId: 'tsk_overdue_scheduled',
      source: 'OBOiFY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([overdueTask]))
      win.localStorage.setItem('OBOiFY:v1:timeBlocks', JSON.stringify([overdueScheduledBlock]))
    })

    // Sign in and navigate directly to Timeline view
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // 1. TimeBlock renders on grid
    cy.contains('Tax Filing Review Session').should('be.visible')

    // 2. Subtle overdue indicator icon is visible
    cy.get('[data-testid="overdue-block-indicator"]').should('be.visible')

    // 3. Subtle red left border is applied
    cy.contains('Tax Filing Review Session')
      .closest('.absolute.rounded-xl')
      .should('have.class', 'border-l-4')
      .and('have.class', '!border-l-red-500')
      // Background remains Zen (not painted red)
      .and('not.have.class', 'bg-red-500')
  })

  it('handles Stage 1 silent heads-up financial alerts (7-4 days) without red badge, but visible in dropdown', () => {
    const now = new Date()
    const formatDate = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const fiveDaysLater = new Date(now)
    fiveDaysLater.setDate(fiveDaysLater.getDate() + 5)
    const fiveDaysLaterStr = formatDate(fiveDaysLater)

    const silentSub = {
      id: 'sub_github_copilot',
      name: 'GitHub Copilot',
      amountMinor: 1000, // $10.00
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: fiveDaysLaterStr,
      scope: 'business',
      category: 'dev_tools',
      status: 'active',
      remindDaysBefore: 3,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:subscriptions', JSON.stringify([silentSub]))
    })

    // Sign in
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // 1. Silent heads-up MUST NOT trigger red badge
    cy.get('[data-testid="notification-badge"]').should('not.exist')

    // 2. Open notification bell
    cy.get('aside').find('button[aria-label^="Notifications"]').click()

    // 3. Dropdown shows 1 Heads-up badge in header
    cy.contains('1 Heads-up').should('be.visible')
    cy.contains('GitHub Copilot Renews Soon').should('be.visible')
    cy.contains('Cost: $10.00 in 5 days').should('be.visible')
    cy.contains('Heads-up').should('be.visible')
    cy.contains('Review Capital Hub').should('be.visible')
    cy.contains('Mark Paid').should('be.visible')

    // 4. Click Review Capital Hub routes to /app/capital
    cy.contains('Review Capital Hub').click()
    cy.url().should('include', '/app/capital')
  })

  it('handles Stage 2 active warning financial alerts (3-0 days) with red badge and Mark Paid action advancing renewal', () => {
    const now = new Date()
    const formatDate = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const twoDaysLater = new Date(now)
    twoDaysLater.setDate(twoDaysLater.getDate() + 2)
    const twoDaysLaterStr = formatDate(twoDaysLater)

    const urgentSub = {
      id: 'sub_aws_hosting',
      name: 'AWS Cloud Services',
      amountMinor: 8500, // $85.00
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: twoDaysLaterStr,
      scope: 'business',
      category: 'dev_tools',
      status: 'active',
      remindDaysBefore: 3,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:subscriptions', JSON.stringify([urgentSub]))
    })

    // Sign in
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // 1. Active warning MUST trigger red badge with count 1
    cy.get('[data-testid="notification-badge"]')
      .should('be.visible')
      .and('contain', '1')
      .and('have.class', 'bg-red-500')

    // 2. Open notification bell
    cy.get('aside').find('button[aria-label^="Notifications"]').click()

    // 3. Dropdown shows 1 Urgent in header
    cy.contains('1 Urgent').should('be.visible')
    cy.contains('AWS Cloud Services Renews Soon').should('be.visible')
    cy.contains('Cost: $85.00 in 2 days').should('be.visible')
    cy.contains('Urgent').should('be.visible')

    // 4. Click Mark Paid
    cy.contains('Mark Paid').click()

    // 5. Success toast is displayed and alert is removed from dropdown
    cy.contains('Marked AWS Cloud Services as paid').should('be.visible')
    cy.contains('AWS Cloud Services Renews Soon').should('not.exist')
    cy.contains('Mind Clear - No active alerts.').should('be.visible')

    // 6. Red badge disappears from bell
    cy.get('[data-testid="notification-badge"]').should('not.exist')
  })

  it('filters out tasks with startTime from the Unscheduled Tasks sidebar', () => {
    const unscheduledTask = {
      id: 'tsk_unscheduled_item',
      title: 'Unscheduled Sidebar Task',
      notes: '',
      status: 'in_progress',
      gtdList: 'next',
      quadrant: null,
      priority: 'medium',
      dueDate: null,
      scheduledDate: null,
      startTime: null,
      estimateMin: 30,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const futureDate = new Date(now.getTime() + 60 * 60 * 1000)
    const futureStartTime = `${String(futureDate.getHours()).padStart(2, '0')}:${String(futureDate.getMinutes()).padStart(2, '0')}`

    const scheduledTask = {
      id: 'tsk_scheduled_item',
      title: 'Already Scheduled Task on Grid',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'high',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: futureStartTime,
      estimateMin: 45,
      context: [],
      tags: [],
      subtasks: [],
      order: 1001,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([unscheduledTask, scheduledTask]))
    })

    // Sign in and go to Action Hub Timeline
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // 1. Unscheduled task MUST be present in sidebar
    cy.contains('Unscheduled Tasks').should('be.visible')
    cy.contains('Unscheduled Sidebar Task').should('be.visible')

    // 2. Task with startTime MUST NOT appear in the sidebar
    cy.contains('Already Scheduled Task on Grid').should('not.exist')
  })

  it('gives Peace of Mind (State C): tasks scheduled > 10 mins away produce NO alerts', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // 60 minutes in the future: State C (Handled)
    const futureDate = new Date(now.getTime() + 60 * 60 * 1000)
    const startTime60Min = `${String(futureDate.getHours()).padStart(2, '0')}:${String(futureDate.getMinutes()).padStart(2, '0')}`

    const handledTask = {
      id: 'tsk_handled_peace_of_mind',
      title: 'Client Strategy Meeting',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'high',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: startTime60Min,
      estimateMin: 45,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([handledTask]))
    })

    // Sign in
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // Red badge should NOT appear because task is scheduled and > 10m away
    cy.get('[data-testid="notification-badge"]').should('not.exist')

    // Open notification bell
    cy.get('aside').find('button[aria-label^="Notifications"]').click()
    cy.contains('Mind Clear - No active alerts.').should('be.visible')
  })

  it('triggers State B (Upcoming 10-Min Warning) with Reschedule & Focus Now buttons', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // 7 minutes in the future: State B (Upcoming 10-Min Warning)
    const upcomingDate = new Date(now.getTime() + 7 * 60 * 1000)
    const startTime7Min = `${String(upcomingDate.getHours()).padStart(2, '0')}:${String(upcomingDate.getMinutes()).padStart(2, '0')}`

    const upcomingTask = {
      id: 'tsk_upcoming_10min',
      title: 'Sprint Planning Sync',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'high',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: startTime7Min,
      estimateMin: 30,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([upcomingTask]))
    })

    // Sign in
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // 1. Red badge must appear
    cy.get('[data-testid="notification-badge"]').should('be.visible').and('contain', '1')

    // 2. Open dropdown
    cy.get('aside').find('button[aria-label^="Notifications"]').click()

    // 3. Header shows 1 Urgent
    cy.contains('1 Urgent').should('be.visible')

    // 4. Alert shows Starts in [diff] mins and subtitle Sprint Planning Sync
    cy.contains(/Starts in \d+ mins/).should('be.visible')
    cy.contains('Sprint Planning Sync').should('be.visible')

    // 5. Action buttons: Reschedule and Focus Now
    cy.contains('Reschedule').should('be.visible')
    cy.contains('Focus Now').should('be.visible')

    // 6. Clicking Reschedule routes to Timeline with highlight parameter
    cy.contains('Reschedule').click()
    cy.url().should('include', '/app/action?view=timeline&highlight=tsk_upcoming_10min')
  })

  it('prevents Black Hole: tasks scheduled for earlier today whose start time has passed fall back into Overdue/Missed', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Earlier today: start time safely in the past of today (handles midnight rollover)
    const currentMin = now.getHours() * 60 + now.getMinutes()
    const pastMin = Math.max(0, currentMin - 60)
    const startTimePast = `${String(Math.floor(pastMin / 60)).padStart(2, '0')}:${String(pastMin % 60).padStart(2, '0')}`

    const missedTask = {
      id: 'tsk_missed_earlier_today',
      title: 'Afternoon Design Sync',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'high',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: startTimePast,
      estimateMin: 45,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([missedTask]))
    })

    // Sign in
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // 1. Red badge must appear (not swallowed by black hole!)
    cy.get('[data-testid="notification-badge"]').should('be.visible').and('contain', '1')

    // 2. Open notification bell
    cy.get('aside').find('button[aria-label^="Notifications"]').click()

    // 3. Header shows 1 Urgent
    cy.contains('1 Urgent').should('be.visible')

    // 4. Shows Overdue/Missed and task details
    cy.contains('Overdue/Missed').should('be.visible')
    cy.contains('Afternoon Design Sync').should('be.visible')
    cy.contains('Missed scheduled start').should('be.visible')

    // 5. Buttons are Schedule & Focus Now
    cy.contains('Schedule').should('be.visible')
    cy.contains('Focus Now').should('be.visible')
  })

  it('prevents Override: simultaneously renders Overdue, Missed, Upcoming, and Finance alerts in dropdown without replacing each other', () => {
    const now = new Date()
    const formatDate = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const todayStr = formatDate(now)

    // 1. Past Overdue task
    const pastOverdueTask = {
      id: 'tsk_past_overdue_multi',
      title: 'Historical Audit Filing',
      notes: '',
      status: 'in_progress',
      gtdList: 'next',
      quadrant: null,
      priority: 'high',
      dueDate: '2026-10-18',
      scheduledDate: '2026-10-18',
      startTime: null,
      estimateMin: 45,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    // 2. Missed task earlier today (safely in the past of today, handles midnight rollover)
    const currentMin = now.getHours() * 60 + now.getMinutes()
    const pastMin = Math.max(0, currentMin - 45)
    const startTimePast = `${String(Math.floor(pastMin / 60)).padStart(2, '0')}:${String(pastMin % 60).padStart(2, '0')}`

    const missedTask = {
      id: 'tsk_missed_multi',
      title: 'Morning Standup Meeting',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'medium',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: startTimePast,
      estimateMin: 30,
      context: [],
      tags: [],
      subtasks: [],
      order: 1001,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    // 3. Upcoming task in 8 minutes
    const upcomingDate = new Date(now.getTime() + 8 * 60 * 1000)
    const startTimeUpcoming = `${String(upcomingDate.getHours()).padStart(2, '0')}:${String(upcomingDate.getMinutes()).padStart(2, '0')}`

    const upcomingTask = {
      id: 'tsk_upcoming_multi',
      title: 'Product Review Walkthrough',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'high',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: startTimeUpcoming,
      estimateMin: 45,
      context: [],
      tags: [],
      subtasks: [],
      order: 1002,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    // 4. Urgent finance subscription (2 days away)
    const twoDaysLater = new Date(now)
    twoDaysLater.setDate(twoDaysLater.getDate() + 2)
    const twoDaysLaterStr = formatDate(twoDaysLater)

    const urgentSub = {
      id: 'sub_urgent_multi',
      name: 'Figma Enterprise',
      amountMinor: 4500,
      currency: 'USD',
      cycle: 'monthly',
      nextRenewal: twoDaysLaterStr,
      scope: 'business',
      category: 'dev_tools',
      status: 'active',
      remindDaysBefore: 3,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([pastOverdueTask, missedTask, upcomingTask]))
      win.localStorage.setItem('OBOiFY:v1:subscriptions', JSON.stringify([urgentSub]))
    })

    // Sign in
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.url().should('include', '/app')

    // 1. Red badge must show 4 total urgent alerts
    cy.get('[data-testid="notification-badge"]').should('be.visible').and('contain', '4')

    // 2. Open dropdown
    cy.get('aside').find('button[aria-label^="Notifications"]').click()
    cy.contains('4 Urgent').should('be.visible')

    // 3. Verify ALL 4 items physically co-exist simultaneously in the dropdown list!
    cy.contains('Historical Audit Filing').should('be.visible')
    cy.contains('Morning Standup Meeting').should('be.visible')
    cy.contains('Product Review Walkthrough').should('be.visible')
    cy.contains('Figma Enterprise Renews Soon').should('be.visible')

    // 4. Verify corresponding action buttons
    cy.contains('Schedule').should('be.visible')
    cy.contains('Reschedule').should('be.visible')
    cy.contains('Review Capital Hub').should('be.visible')
    cy.contains('Mark Paid').should('be.visible')
  })

  it('carries over overdue tasks into today\'s sidebar, but isolates non-today views', () => {
    const now = new Date()
    const formatDate = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const todayStr = formatDate(now)

    const twoDaysAgo = new Date(now)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysAgoStr = formatDate(twoDaysAgo)

    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = formatDate(tomorrow)

    const overdueTask = {
      id: 'tsk_overdue_carryover',
      title: 'Carryover Overdue Task',
      notes: '',
      status: 'in_progress',
      gtdList: 'next',
      quadrant: null,
      priority: 'high',
      dueDate: twoDaysAgoStr,
      scheduledDate: twoDaysAgoStr,
      startTime: null,
      estimateMin: 45,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    const todayTask = {
      id: 'tsk_today_unscheduled',
      title: 'Today Unscheduled Task',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'medium',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: null,
      estimateMin: 30,
      context: [],
      tags: [],
      subtasks: [],
      order: 1001,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    const tomorrowTask = {
      id: 'tsk_tomorrow_task',
      title: 'Tomorrow Isolated Task',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'low',
      dueDate: tomorrowStr,
      scheduledDate: tomorrowStr,
      startTime: null,
      estimateMin: 60,
      context: [],
      tags: [],
      subtasks: [],
      order: 1002,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([overdueTask, todayTask, tomorrowTask]))
    })

    // Sign in and go to Timeline view
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // 1. On Today's view: Overdue carry-over and Today's task MUST appear; Tomorrow's must NOT appear
    cy.contains('Unscheduled Tasks').should('be.visible')
    cy.contains('Carryover Overdue Task').should('be.visible')
    cy.contains('Today Unscheduled Task').should('be.visible')
    cy.contains('Tomorrow Isolated Task').should('not.exist')

    // 2. Click Next Day to navigate to tomorrow
    cy.get('button[title="Next day"]').click()

    // 3. On Tomorrow's view: Tomorrow's task MUST appear; Overdue carry-over and Today's task must NOT appear
    cy.contains('Tomorrow Isolated Task').should('be.visible')
    cy.contains('Carryover Overdue Task').should('not.exist')
    cy.contains('Today Unscheduled Task').should('not.exist')
  })

  it('opens full TaskModal from sidebar card click or edit icon, allowing title and priority editing', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const taskToEdit = {
      id: 'tsk_edit_me',
      title: 'Original Sidebar Task Title',
      notes: 'Initial notes content',
      status: 'in_progress',
      gtdList: 'next',
      quadrant: 'do',
      priority: 'medium',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: null,
      estimateMin: 30,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([taskToEdit]))
    })

    // Sign in and visit Timeline
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // 1. Task renders in sidebar
    cy.contains('Original Sidebar Task Title').should('be.visible')

    // 2. Click the edit button
    cy.get('[data-testid="edit-task-btn-tsk_edit_me"]').click()

    // 3. Global Edit Task modal opens
    cy.contains('Edit Task').should('be.visible')
    cy.get('input#title').should('have.value', 'Original Sidebar Task Title')

    // 4. Update title and save
    cy.get('input#title').clear().type('Updated Sidebar Task Title')
    cy.contains('button', 'Save Changes').click()

    // 5. Modal closes and updated title is reflected in sidebar
    cy.contains('Edit Task').should('not.exist')
    cy.contains('Updated Sidebar Task Title').should('be.visible')
  })

  it('eradicates ghost tasks and ghost blocks from timeline', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const liveTask = {
      id: 'tsk_live_1',
      title: 'Valid Live Task',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'medium',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: '10:00',
      estimateMin: 60,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    const liveBlock = {
      id: 'blk_live_1',
      title: 'Valid Live Task Block',
      category: 'deep_work',
      color: 'cyan',
      start: `${todayStr}T10:00:00.000Z`,
      end: `${todayStr}T11:00:00.000Z`,
      taskId: 'tsk_live_1',
      source: 'OBOiFY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    // Ghost block pointing to a permanently deleted task
    const ghostBlock = {
      id: 'blk_ghost_deleted',
      title: 'Ghost Deleted Task Block',
      category: 'deep_work',
      color: 'cyan',
      start: `${todayStr}T11:30:00.000Z`,
      end: `${todayStr}T12:30:00.000Z`,
      taskId: 'tsk_already_deleted_999',
      source: 'OBOiFY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([liveTask]))
      win.localStorage.setItem('OBOiFY:v1:timeBlocks', JSON.stringify([liveBlock, ghostBlock]))
    })

    // Sign in and visit Timeline
    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // Live block is rendered
    cy.contains('Valid Live Task Block').should('be.visible')

    // Ghost block must be eradicated (never rendered)
    cy.contains('Ghost Deleted Task Block').should('not.exist')
  })

  it('opens Contextual Action Popover on TimeBlock and closes on outside click', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const task = {
      id: 'tsk_popover_test',
      title: 'Contextual Popover Task',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'medium',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: '01:00',
      estimateMin: 60,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    const block = {
      id: 'blk_popover_test',
      title: 'Contextual Popover Task',
      category: 'deep_work',
      color: 'cyan',
      start: `${todayStr}T01:00:00.000Z`,
      end: `${todayStr}T02:00:00.000Z`,
      taskId: 'tsk_popover_test',
      source: 'OBOiFY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([task]))
      win.localStorage.setItem('OBOiFY:v1:timeBlocks', JSON.stringify([block]))
    })

    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // Block renders on grid
    cy.contains('Contextual Popover Task').should('be.visible')
    cy.get('[data-testid="block-action-popover-blk_popover_test"]').should('not.exist')

    // Click trash/remove icon to toggle popover
    cy.get('[data-testid="block-menu-trigger-blk_popover_test"]').click({ force: true })

    // Popover is displayed with exactly TWO options
    cy.get('[data-testid="block-action-popover-blk_popover_test"]').should('be.visible')
    cy.get('[data-testid="unschedule-block-btn"]').should('be.visible').and('contain', 'Unschedule')
    cy.get('[data-testid="delete-permanently-btn"]').should('be.visible').and('contain', 'Delete Permanently')

    // Clicking outside closes the popover
    cy.get('body').click(0, 0)
    cy.get('[data-testid="block-action-popover-blk_popover_test"]').should('not.exist')
  })

  it('unschedules task via Action Popover, removing it from grid and returning it to sidebar', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const task = {
      id: 'tsk_unschedule_test',
      title: 'Task To Unschedule',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'high',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: '01:00',
      estimateMin: 45,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    const block = {
      id: 'blk_unschedule_test',
      title: 'Task To Unschedule',
      category: 'deep_work',
      color: 'cyan',
      start: `${todayStr}T01:00:00.000Z`,
      end: `${todayStr}T01:45:00.000Z`,
      taskId: 'tsk_unschedule_test',
      source: 'OBOiFY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([task]))
      win.localStorage.setItem('OBOiFY:v1:timeBlocks', JSON.stringify([block]))
    })

    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // Initial state: block on grid, NOT in unscheduled sidebar
    cy.get('[data-testid="block-menu-trigger-blk_unschedule_test"]').should('be.visible')
    cy.contains('Unscheduled Tasks').should('be.visible')
    cy.contains('All tasks are scheduled for today!').should('be.visible')

    // Open popover and click Unschedule
    cy.get('[data-testid="block-menu-trigger-blk_unschedule_test"]').click({ force: true })
    cy.get('[data-testid="unschedule-block-btn"]').click()

    // 1. TimeBlock is removed from grid
    cy.get('[data-testid="block-menu-trigger-blk_unschedule_test"]').should('not.exist')

    // 2. Task appears in Unscheduled Tasks sidebar
    cy.contains('Task To Unschedule').should('be.visible')
    cy.contains('All tasks are scheduled for today!').should('not.exist')
  })

  it('permanently deletes task via Action Popover, eradicating it from both grid and sidebar', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const task = {
      id: 'tsk_delete_perm_test',
      title: 'Task To Delete Forever',
      notes: '',
      status: 'in_progress',
      gtdList: 'scheduled',
      quadrant: null,
      priority: 'high',
      dueDate: todayStr,
      scheduledDate: todayStr,
      startTime: '02:00',
      estimateMin: 45,
      context: [],
      tags: [],
      subtasks: [],
      order: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    const block = {
      id: 'blk_delete_perm_test',
      title: 'Task To Delete Forever',
      category: 'deep_work',
      color: 'cyan',
      start: `${todayStr}T02:00:00.000Z`,
      end: `${todayStr}T02:45:00.000Z`,
      taskId: 'tsk_delete_perm_test',
      source: 'OBOiFY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    }

    cy.window().then((win) => {
      win.localStorage.setItem('OBOiFY:v1:tasks', JSON.stringify([task]))
      win.localStorage.setItem('OBOiFY:v1:timeBlocks', JSON.stringify([block]))
    })

    cy.visit('/login')
    cy.get('[data-testid="google-signin-btn"]').click()
    cy.visit('/app/action?view=timeline')

    // Open popover and click Delete Permanently
    cy.get('[data-testid="block-menu-trigger-blk_delete_perm_test"]').click({ force: true })
    cy.get('[data-testid="delete-permanently-btn"]').click()

    // Eradicated completely from grid and sidebar
    cy.contains('Task To Delete Forever').should('not.exist')
    cy.get('[data-testid="block-menu-trigger-blk_delete_perm_test"]').should('not.exist')
  })
})
