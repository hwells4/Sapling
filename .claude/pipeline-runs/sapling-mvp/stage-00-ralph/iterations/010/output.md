Completed task **Sapling-b2k: Build New Task wizard**.

**Summary:**
- Created a 4-step wizard component (`NewTaskWizard`) in `src/components/wizard/new-task-wizard.tsx`
- **Step 1 (Goal)**: Text area for describing what the user wants done
- **Step 2 (Template)**: Card-based template selector showing capabilities and estimated costs
- **Step 3 (Scope)**: Toggle-based integration scope selector for granting system access
- **Step 4 (Confirm)**: Read-only summary with contract preview and trust notice

The component follows existing UI patterns (Tailwind with CSS variables, cn() utility, transitions under 200ms) and exports types for consumers.
