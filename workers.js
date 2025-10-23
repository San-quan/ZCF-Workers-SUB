// Cloudflare Workers - 自建Subconverter后端 (2025版，适配SUBAPI.cmliussss.net风格)
// 支持: 自动测速 (url-test) + 加密订阅 (base64) + 分流规则 (INI加载)
// 部署: Cloudflare Workers > 新建 > 编辑 > 粘贴 > 保存 > 绑定域名

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const search = url.search;

  // base64加密订阅支持: ?url=base64(原订阅URL)
  if (search.includes('url=')) {
    let subUrl = url.searchParams.get('url');
    if (subUrl) {
      try {
        subUrl = atob(subUrl);  // base64解码
      } catch (e) {
        return new Response('解码失败', { status: 400 });
      }
    }

    // 加载INI模板 (嵌入或KV)
    const iniTemplate = `...`;  // 替换为上面完整INI内容 (用字符串变量)

    // 转发到SUBAPI.cmliussss.net (或本地逻辑)
    const subconverterUrl = `https://subapi.cmliussss.net/sub?target=clash&config=${encodeURIComponent(iniTemplate)}&url=${encodeURIComponent(subUrl)}`;

    const response = await fetch(subconverterUrl);
    if (!response.ok) {
      return new Response('转换失败', { status: response.status });
    }

    let yaml = await response.text();

    // 注入自动测速 (url-test组)
    yaml = yaml.replace(/type: select/g, 'type: url-test');  // 简单替换select为url-test (高级用yaml解析)
    yaml = yaml.replace(/interval: 0/g, 'interval: 300');  // 添加interval
    yaml = yaml.replace(/url: ""/g, 'url: "http://www.gstatic.com/generate_204"');

    return new Response(yaml, { headers: { 'Content-Type': 'text/yaml' } });
  }

  // 默认返回INI或健康检查
  if (path === '/ini') {
    return new Response(iniTemplate, { headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response('私有后端就绪，支持 /?url=base64(订阅)', { status: 200 });
}
