# 进入仓库根目录
mkdir -p functions
cat > functions/_middleware.js <<'EOF'
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const PASS = env.PAGE_PASS || "556677";
  const queryPwd = url.searchParams.get("pwd");
  const authHeader = request.headers.get("Authorization");
  const basicPwd = authHeader ? atob(authHeader.split(" ")[1]).split(":")[1] : null;
  if ((queryPwd || basicPwd) !== PASS) {
    return new Response("401 Unauthorized", { status: 401 });
  }
  return next();
}
EOF
git add functions/_middleware.js
git commit -m "add access password"
git push
