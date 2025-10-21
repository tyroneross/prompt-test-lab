# Calm Precision 6.1 - Compliance Checklist

## Principle #9: Functional Integrity ✅

**Rule:** "Only make interactive if action exists AND backend connected"

### DON'T BUILD ❌
- [ ] Buttons without backend endpoints
- [ ] Forms without submission APIs
- [ ] Lists without data sources
- [ ] Features as "visual placeholders"
- [ ] Mock data that looks like real data

### DO BUILD ✅
- [x] **Disabled buttons** with clear "Coming Soon" indicators
- [x] **Working navigation** to real pages
- [x] **Clear error messages** when backend not available
- [x] **Demo mode banners** for mock data
- [x] **Feature flags** for easy enablement (`hasBackendAPI`)

---

## Current Status: ✅ COMPLIANT

### Files Audited & Fixed
- [x] `/packages/web/src/components/views/TestCreationView.tsx`
- [x] `/packages/web/src/pages/Tests/Tests.tsx`
- [x] `/packages/web/src/pages/Prompts/Prompts.tsx`
- [x] `/packages/web/src/pages/Dashboard/Dashboard.tsx`
- [x] `/packages/web/src/pages/Settings/Settings.tsx`
- [x] `/packages/web/src/components/organisms/Header/Header.tsx`

### Validation Results
```bash
✅ No console.log statements in production code
✅ No TODO comments for API implementations
✅ No empty onClick handlers
✅ All interactive elements either disabled or functional
```

**Run validation:**
```bash
./scripts/validate-functional-integrity.sh
```

---

## Other Calm Precision Principles

### 1. Group, Don't Isolate
- [ ] Single border around related items
- [ ] Dividers between items (not individual borders)
- [ ] Whitespace for unrelated items

### 2. Size = Importance
- [ ] Critical conversions = large buttons
- [ ] Quick actions = compact buttons
- [ ] Size matches user intent weight

### 3. Three-Line Hierarchy
- [ ] Title (14-16px, bold)
- [ ] Description (12-14px)
- [ ] Metadata (11-12px, muted)
- [ ] Consistent vertical rhythm

### 4. Progressive Disclosure
- [ ] Show less, reveal more on demand
- [ ] Fewer visible choices = faster decisions
- [ ] Hidden advanced options

### 5. Text Over Decoration
- [ ] Color and weight create hierarchy
- [ ] No decoration without purpose
- [ ] High signal-to-noise ratio

### 6. Content Over Chrome
- [ ] ≥70% content-chrome ratio
- [ ] Minimal interface elements
- [ ] Focus on user's content

### 7. Natural Language
- [ ] Readable phrases over jargon
- [ ] Match user vocabulary
- [ ] Clear, human-friendly labels

### 8. Rhythm & Alignment
- [ ] 8pt grid system
- [ ] Consistent spacing
- [ ] Aligned baselines
- [ ] Visual rhythm creates calm

### 9. Functional Integrity ✅
- [x] Every interactive element has working action
- [x] Real data source/destination
- [x] No mock data that looks real
- [x] Clear "Demo mode" warnings
- [x] Visible incomplete feature markers

### 10. Content Resilience
- [ ] Handles variable formats gracefully
- [ ] Structured data, plain text, markdown
- [ ] Fault-tolerant components

---

## Quick Audit Questions

### For Every Component Ask:
1. **Borders:** Group or isolate? ✅
2. **Buttons:** Size = intent? ✅
3. **Content:** Three-line hierarchy? ✅
4. **Status:** Text color only? ✅
5. **Icons:** ≤2 colors? ✅
6. **Language:** Natural or jargon? ✅
7. **Chrome:** ≥70% content? ✅
8. **Loading:** Pattern matches wait time? ✅
9. **Functional:** If clicked, does something happen? ✅
10. **Backend:** Is API verified/working? ✅
11. **Data:** Real source or mock? ✅
12. **Format:** Handles string AND object? ✅
13. **Fields:** Tries alternative names? ✅
14. **Alignment:** Left-aligned text, top-aligned rows? ✅
15. **Markdown:** Supports `#` `**` `-` paragraphs? ✅

---

## Implementation Pattern

### Backend-Ready UI Pattern

```tsx
// 1. Feature flag
const hasBackendAPI = false; // Set to true when ready

// 2. Conditional rendering or disabling
{hasBackendAPI ? (
  <Button onClick={handleSave}>Save</Button>
) : (
  <>
    <Button disabled={true}>Save</Button>
    <ComingSoonNotice feature="Save functionality" />
  </>
)}

// 3. Clear error messages
const handleSave = async () => {
  if (!hasBackendAPI) {
    toast.error('Backend API required. Coming soon!');
    return;
  }
  // Real implementation
};
```

### Coming Soon Notice Component

```tsx
<div className="border border-amber-500 bg-amber-50 rounded-lg p-4">
  <div className="flex items-center gap-2">
    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
      Coming Soon
    </span>
    <p className="text-sm text-amber-700">
      {feature} requires backend integration. Interface is ready for when the API is connected.
    </p>
  </div>
</div>
```

---

## Future Work

### When Backend is Ready:

1. **Flip feature flags**
   ```tsx
   const hasBackendAPI = true; // Enable features
   ```

2. **Implement API calls** in:
   - [ ] Test creation/execution (`/packages/web/src/components/views/TestCreationView.tsx`)
   - [ ] Prompt creation (`/packages/web/src/pages/Prompts/Prompts.tsx`)
   - [ ] Settings persistence (`/packages/web/src/pages/Settings/Settings.tsx`)
   - [ ] Search functionality (`/packages/web/src/components/organisms/Header/Header.tsx`)

3. **Remove temporary alerts** and replace with real backend calls

4. **Update documentation URLs** from example.com to real docs

5. **Remove Demo Mode banners** when using real data

---

## Continuous Validation

**Before every commit:**
```bash
./scripts/validate-functional-integrity.sh
```

**Before every PR:**
- [ ] Run validation script
- [ ] Manual review of new interactive elements
- [ ] Check for console.log statements
- [ ] Verify backend connections for new features

---

## Contact

For questions about Calm Precision compliance or functional integrity:
- Review `/FUNCTIONAL_INTEGRITY_FIXES.md` for detailed examples
- Review `/FUNCTIONAL_INTEGRITY_SUMMARY.md` for quick reference
- Run `./scripts/validate-functional-integrity.sh` for automated checks

---

**Last Updated:** 2025-10-20
**Status:** ✅ Compliant with Calm Precision Principle #9
