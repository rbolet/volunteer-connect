import type { PrismaClient } from "@vc/db"
import { createDemoSessionRepo, type DemoSessionRepo } from "./demo-session"
import { createSignupsRepo, type SignupsRepo } from "./signups"
import { createSlotResponsesRepo, type SlotResponsesRepo } from "./slot-responses"
import { createSlotsRepo, type SlotsRepo } from "./slots"
import { createTeamsRepo, type TeamsRepo } from "./teams"

// Injected into createApp() so route tests can substitute in-memory fakes
// without touching Prisma.
export interface Repos {
  demoSession: DemoSessionRepo
  signups: SignupsRepo
  slotResponses: SlotResponsesRepo
  slots: SlotsRepo
  teams: TeamsRepo
}

export function createRepos(prisma: PrismaClient): Repos {
  return {
    demoSession: createDemoSessionRepo(prisma),
    signups: createSignupsRepo(prisma),
    slotResponses: createSlotResponsesRepo(prisma),
    slots: createSlotsRepo(prisma),
    teams: createTeamsRepo(prisma),
  }
}

export type { DemoSessionRepo, SignupsRepo, SlotResponsesRepo, SlotsRepo, TeamsRepo }
export type { ClaimResult, WithdrawResult } from "./slot-responses"
export type { CreateSignupResult, StatusChangeResult } from "./signups"
export type { SlotMutationResult } from "./slots"
