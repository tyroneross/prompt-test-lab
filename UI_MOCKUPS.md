# Prompt Testing Lab - UI Mockup Variations

## Overview

Three distinct UI mockup variations for the main prompt testing interface, each optimizing for different user preferences and workflows while maintaining consistency with the minimal design philosophy.

## Mockup Variation A: "Studio Layout"
*Optimized for power users who prefer comprehensive control*

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [≡] Prompt Testing Lab    [🔄 Project: AI Research]    [⚙️] [👤 User] [?]      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────────────────────────────────────────┐ │
│ │ PROMPTS         │ │ TEST CONFIGURATION                                      │ │
│ │                 │ │                                                         │ │
│ │ [+ New Prompt]  │ │ Variants to Test:                                       │ │
│ │                 │ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ 📝 Summarizer   │ │ │ A │ Original Prompt    [Edit] [×]                  │ │ │
│ │    v1.2 ●       │ │ │ B │ + Add Variant       [+]                       │ │ │
│ │                 │ │ └─────────────────────────────────────────────────────┘ │ │
│ │ 📝 Categorizer  │ │                                                         │ │
│ │    v2.1         │ │ Models:                                                 │ │
│ │                 │ │ ☑️ GPT-4o     ☑️ Claude-3.5   ☐ Llama-3.1              │ │
│ │ 📝 Formatter    │ │                                                         │ │
│ │    v1.0         │ │ Test Content: [Upload Files ▼] [5 items selected]      │ │
│ │                 │ │                                                         │ │
│ │ [Search...]     │ │ [Advanced Settings ▼]                                  │ │
│ │                 │ │                                                         │ │
│ └─────────────────┘ │ Cost Estimate: ~$2.50 | Time: ~3 min                   │ │
│                     │                                                         │ │
│                     │ [Cancel]              [▶️ Run Test]                     │ │
│                     └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────┤
│ EXECUTION STATUS                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Test Session: "Content Analysis" (Running...)                              │ │
│ │ ████████████████████░░░░░░░░░░ 15/20 tests complete (75%)                  │ │
│ │                                                                             │ │
│ │ Current: Variant B → GPT-4o → Sample 3   [⏸️ Pause] [⏹️ Stop]               │ │
│ │ Queue: 5 pending | Errors: 1 (retry available)                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Traditional three-panel layout familiar to developers
- Persistent prompt library for quick access
- Comprehensive test configuration in center panel
- Real-time execution status at bottom
- All primary actions visible simultaneously

**Target User**: Power users, developers, researchers who run frequent tests

---

## Mockup Variation B: "Workflow Layout"
*Optimized for step-by-step guided testing process*

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [≡] Prompt Testing Lab         Step 2 of 4: Configure Test                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─ ● ─┬─ ○ ─┬─ ○ ─┬─ ○ ─┐    Progress Indicator                               │
│ │Setup│Test │Run  │View │                                                      │
│ └─────┴─────┴─────┴─────┘                                                      │
│                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │                          TEST CONFIGURATION                                 │ │
│ │                                                                             │ │
│ │ Which prompts do you want to test?                                          │ │
│ │                                                                             │ │
│ │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                │ │
│ │ │ A │ Summarizer  │ │ B │ + Add New   │ │ C │ + Add New   │                │ │
│ │ │   │ Original    │ │   │ Variant     │ │   │ Variant     │                │ │
│ │ │   │ ✓ Selected  │ │   │             │ │   │             │                │ │
│ │ └─────────────────┘ └─────────────────┘ └─────────────────┘                │ │
│ │                                                                             │ │
│ │ Which AI models should run the test?                                        │ │
│ │                                                                             │ │
│ │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐    │ │
│ │ │ GPT-4o        │ │ Claude-3.5    │ │ Llama-3.1     │ │ Custom...     │    │ │
│ │ │ ✓ Selected    │ │ ✓ Selected    │ │ ○ Available   │ │ ○ Configure   │    │ │
│ │ │ Fast, Accurate│ │ Best for long │ │ Open source   │ │ Your endpoint │    │ │
│ │ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘    │ │
│ │                                                                             │ │
│ │ Cost: $2.50 estimated | Time: ~3 minutes                                   │ │
│ │                                                                             │ │
│ │ [← Back: Setup]                              [Continue: Run Test →]        │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Clear step-by-step progression indicator
- Single focus area prevents cognitive overload
- Guided questions with visual selection
- Forward/back navigation with clear next steps
- Estimated cost/time prominently displayed

**Target User**: New users, occasional testers, teams needing structured workflows

---

## Mockup Variation C: "Dashboard Layout"
*Optimized for overview and quick actions*

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Prompt Testing Lab    [🔍 Search everything...]    [+ Quick Test] [👤 Profile] │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─────────────────────────────────────┐ ┌───────────────────────────────────┐   │
│ │ RECENT ACTIVITY                     │ │ QUICK ACTIONS                     │   │
│ │                                     │ │                                   │   │
│ │ ▶️ Content Analysis (2 min ago)     │ │ [▶️ Run Last Test]                │   │
│ │   3 variants × 2 models × 5 samples │ │ [📝 New Prompt]                   │   │
│ │   Winner: Variant B (93% success)   │ │ [📊 View Analytics]               │   │
│ │                                     │ │ [⚙️ Project Settings]             │   │
│ │ 📈 Weekly Summary (completed)       │ │                                   │   │
│ │   47 tests, $12.30 spent           │ └───────────────────────────────────┘   │
│ │                                     │                                       │
│ │ 🔧 Prompt Tuning (in progress...)   │ ┌───────────────────────────────────┐   │
│ │   ████████░░ 8/10 complete          │ │ PERFORMANCE OVERVIEW              │   │
│ │                                     │ │                                   │   │
│ └─────────────────────────────────────┘ │ Success Rate    Token Usage       │   │
│                                         │ ████████████    ██████░░░░        │   │
│ ┌─────────────────────────────────────┐ │ 89%             2.1M tokens       │   │
│ │ YOUR PROMPTS                        │ │                                   │   │
│ │                                     │ │ Avg Cost/Test   Best Model        │   │
│ │ 📝 Summarizer v1.2    [Test] [Edit] │ │ $1.23          Claude-3.5         │   │
│ │ 📝 Categorizer v2.1   [Test] [Edit] │ │                                   │   │
│ │ 📝 Formatter v1.0     [Test] [Edit] │ └───────────────────────────────────┘   │
│ │ 📝 Custom Analysis    [Test] [Edit] │                                       │
│ │                                     │ ┌───────────────────────────────────┐   │
│ │ [+ Create New Prompt]               │ │ TEAM ACTIVITY                     │   │
│ │ [📁 Browse All Prompts]             │ │                                   │   │
│ │                                     │ │ Sarah added "Email Classifier"    │   │
│ └─────────────────────────────────────┘ │ Mike completed "Sentiment Test"   │   │
│                                         │ 3 new shared prompts available    │   │
│                                         │                                   │   │
│                                         │ [View Team Dashboard]             │   │
│                                         └───────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Card-based dashboard layout with key information at a glance
- Recent activity prominently featured
- Quick actions for common tasks
- Performance metrics visible immediately
- Team collaboration elements integrated
- Global search for everything

**Target User**: Team leads, managers, users who need overview and quick access

---

## Component Specifications

### Common Components Across All Variations

#### Progress Indicators
```
Loading State:
┌─────────────────────────────────┐
│ Testing prompts... ████████░░░░ │
│ 8 of 12 complete               │
└─────────────────────────────────┘

Status Badges:
● Running  ○ Pending  ✓ Complete  ✗ Failed
```

#### Test Result Cards
```
┌─────────────────────────────────────────────────────────────┐
│ Variant A: Original Prompt                            [⭐] │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐   │
│ │ Success     │ Avg Time    │ Tokens      │ Cost        │   │
│ │ 89%         │ 1.2s        │ 245         │ $0.012      │   │
│ └─────────────┴─────────────┴─────────────┴─────────────┘   │
│ [View Details] [Export] [Use as Template]                  │
└─────────────────────────────────────────────────────────────┘
```

#### Model Selection
```
Available Models:
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ GPT-4o        │ │ Claude-3.5    │ │ Llama-3.1     │
│ ✓ Selected    │ │ ○ Available   │ │ ○ Available   │
│ $0.005/1K tok │ │ $0.003/1K tok │ │ Free/Local    │
└───────────────┘ └───────────────┘ └───────────────┘
```

### Responsive Adaptations

#### Mobile Layout (< 640px)
```
┌─────────────────────┐
│ [≡] Prompt Lab [+]  │
├─────────────────────┤
│                     │
│ [Recent Tests ▼]    │
│                     │
│ ○ Content Analysis  │
│   2 min ago         │
│   [View Results]    │
│                     │
│ ○ Weekly Summary    │
│   Yesterday         │
│   [View Results]    │
│                     │
│ [+ New Test]        │
│                     │
│ ┌─── Quick Stats ──┐ │
│ │ 89% Success     │ │
│ │ $12.30 Spent    │ │
│ └─────────────────┘ │
│                     │
│ [Prompts] [Tests]   │
│ [Results] [More]    │
└─────────────────────┘
```

#### Tablet Layout (640px - 1024px)
```
┌─────────────────────────────────────────────────────┐
│ [≡] Prompt Testing Lab           [🔍] [+] [Profile] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────┐ ┌─────────────────────────┐ │
│ │ RECENT TESTS        │ │ ACTIVE PROMPTS          │ │
│ │                     │ │                         │ │
│ │ Content Analysis    │ │ 📝 Summarizer v1.2      │ │
│ │ [View] [Rerun]      │ │ 📝 Categorizer v2.1     │ │
│ │                     │ │ 📝 Formatter v1.0       │ │
│ │ Weekly Summary      │ │                         │ │
│ │ [View] [Rerun]      │ │ [+ New Prompt]          │ │
│ │                     │ │                         │ │
│ └─────────────────────┘ └─────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ QUICK ACTIONS                                   │ │
│ │ [Run Test] [Analytics] [Settings] [Team]        │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Interaction Patterns

### Drag and Drop
- Prompts can be dragged from library to test slots
- Test content files can be dropped into upload areas
- Visual feedback with drop zones and preview states

### Keyboard Shortcuts
- `Ctrl/Cmd + N`: New prompt
- `Ctrl/Cmd + T`: New test
- `Space`: Play/pause current test
- `Escape`: Cancel/close modals
- `Tab/Shift+Tab`: Navigate between test variants

### Real-time Updates
- WebSocket connection for live test progress
- Optimistic UI updates for immediate feedback
- Graceful degradation to polling if WebSocket fails
- Toast notifications for background completions

## Accessibility Features

### Screen Reader Support
- Semantic landmarks (main, nav, aside, section)
- ARIA live regions for dynamic content updates
- Descriptive button and link text
- Table headers and captions for data

### Keyboard Navigation
- Skip links to main content
- Focus indicators with 2px high-contrast outline
- Logical tab order throughout interface
- Modal focus trapping

### Visual Accessibility
- 4.5:1 minimum contrast ratio
- No color-only information
- Scalable text up to 200%
- Reduced motion preferences respected

## Design Rationale

### Why Three Variations?

**Variation A (Studio)** serves power users who need comprehensive control and prefer seeing all options simultaneously. The traditional three-panel layout is familiar to developers and provides efficiency for frequent testing.

**Variation B (Workflow)** guides new users through the testing process step-by-step, reducing cognitive load and ensuring proper configuration. The wizard-like approach helps teams establish consistent testing practices.

**Variation C (Dashboard)** provides executive-level overview while maintaining quick access to common actions. The card-based layout scales well across devices and integrates team collaboration naturally.

Each variation maintains core usability principles while optimizing for different user types and scenarios, allowing the product to serve a broader user base effectively.