// ResolvedSession + demo-session shapes (see __docs/AUTH.md). Like everything
// in this package these are z.infer re-exports from @vc/zod — the Zod schema
// is the runtime source of truth (Express validates the trusted header against
// it); this file exists so consumers can import the type without the schemas.
export type {
  ResolvedSession,
  DemoIdentity,
  DemoSessionResponse,
  AppSessionResponse,
} from "@vc/zod"
