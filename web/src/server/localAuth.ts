import "server-only";

export type LocalAuthState = {
  userId: string;
  orgId: string | null;
};

const localUserId = process.env.LOCAL_AUTH_USER_ID || "local-admin";
const localUserName = process.env.LOCAL_AUTH_USER_NAME || "Local Admin";
const localOrgId = process.env.LOCAL_AUTH_ORG_ID || null;
const localOrgName = process.env.LOCAL_AUTH_ORG_NAME || "Local";

export function auth(): LocalAuthState {
  return {
    userId: localUserId,
    orgId: localOrgId && localOrgId.length > 0 ? localOrgId : null,
  };
}

export const clerkClient = {
  users: {
    async getUser(userId: string) {
      return {
        id: userId,
        username: localUserName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        firstName: localUserName,
        lastName: "",
        privateMetadata: {},
      };
    },
  },
  organizations: {
    async getOrganization(params?: { organizationId?: string }) {
      return {
        id: params?.organizationId || localOrgId,
        name: localOrgName,
      };
    },
  },
};
