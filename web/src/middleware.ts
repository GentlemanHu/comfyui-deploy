import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPrefixes = ["/api"];

function isPublicPath(pathname: string) {
  return publicPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function middleware(request: NextRequest) {
  const password = process.env.LOCAL_AUTH_PASSWORD;
  if (!password || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const [, encoded] = authorization.split(" ");
      const [, providedPassword] = atob(encoded).split(":");
      if (providedPassword === password) {
        return NextResponse.next();
      }
    } catch {
      return unauthorized();
    }
  }

  return unauthorized();
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ComfyUI Deploy"',
    },
  });
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
  // matcher: ['/','/create', '/api/(twitter|generation|init|voice-cloning)'],
};
