// Shared TypeScript types — see docs/DATA_MODEL.md for domain reference.
// These are `z.infer` types re-exported from @vc/zod, not hand-declared: the
// Zod schema is the single source of truth for each entity's shape, so
// consumers who only need the type (not runtime validation) can import it
// here without pulling zod schemas into scope.
export type {
  OrgRoleType,
  TeamRole,
  SignupMode,
  SignupStatus,
  SlotResponseStatus,
  OrganizationInput,
  SeasonInput,
  TeamInput,
  UserInput,
  OrgRoleInput,
  TeamMembershipInput,
  EventInput,
  SignupInput,
  SignupSlotInput,
  SlotResponseInput,
  CreateSignupInput,
  SignupStatusChangeInput,
  SignupListItem,
  SignupDetail,
  SignupSlotView,
  SlotResponseView,
  TeamWithPoints,
  MyResponseView,
} from "@vc/zod"
export type { ResolvedSession, DemoIdentity, DemoSessionResponse } from "./session"
