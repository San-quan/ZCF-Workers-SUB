// _worker.js - 自建Subconverter后端 (2025版，适配Cloudflare-BackCN.ini)
// 支持: 自动测速 (url-test) + 加密订阅 (base64) + 分流规则 (INI加载 + KV存储)
// 部署: Cloudflare Workers > 新建 > 编辑 > 粘贴 > 保存 > 绑定域名
// 作者: 艾米 (sanquan开发, 2025.10.23)

let mytoken = 'auto';  // 主token，自定义或UUID
let guestToken = '';   // 访客token，空或UUID[](https://1024tools.com/uuid)
let BotToken = '';     // Telegram Bot Token (@BotFather 获取)
let ChatID = '';       // Telegram Chat ID (@userinfobot 获取)
let TG = 0;            // 1推送访问信息，0不推送
let FileName = 'CF-Workers-SUB';  // 订阅文件名
let SUBUpdateTime = 6; // 订阅更新间隔（小时）
let total = 99;        // 流量限制（TB）
let timestamp = 4102329600000; // 2099-12-31

// 节点链接 + 订阅链接
let MainData = `
https://cfxr.eu.org/getSub
`;

// 默认INI嵌入（从KV加载，失败用此）
function getDefaultINI() {
  return `[general]
loglevel = info
append = false
skip-missed = true
tproxy = true
error-report = true
log-file = /tmp/subconverter.log

[rule_provider]
geoip-cn = type: http, behavior: classical, url: "https://raw.githubusercontent.com/Loyalsoldier/geoip/release/CN.txt", path: ./ruleset/geoip-cn.yaml, interval: 43200
geosite-cn = type: http, behavior: classical, url: "https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/geosite-cn.dat", path: ./ruleset/geosite-cn.yaml, interval: 43200
alibaba = type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Alibaba.list", path: ./ruleset/alibaba.yaml, interval: 43200
tencent = type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Tencent.list", path: ./ruleset/tencent.yaml, interval: 43200
baidu = type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Baidu.list", path: ./ruleset/baidu.yaml, interval: 43200
lan = type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Lan.list", path: ./ruleset/lan.yaml, interval: 43200
banad = type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list", path: ./ruleset/banad.yaml, interval: 43200
adblock_reject = type: http, behavior: domain, url: "https://raw.githubusercontent.com/REIJI007/AdBlock_Rule_For_Clash/main/adblock_reject.yaml", path: ./ruleset/adblock_reject.yaml, interval: 1200
gfw = type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/GreatFire.list", path: ./ruleset/gfw.yaml, interval: 43200

[template]
clash-config = |
  mixed-port: 7890
  allow-lan: true
  mode: rule
  log-level: debug
  external-controller: 0.0.0.0:9090
  secret: ""
  ipv6: true
proxy-providers = |
  backcn_subscription:
    type: http
    url: "${backcn_sub_url}"
    interval: 3600
    health-check:
      enable: true
      url: "http://www.gstatic.com/generate_204"
      interval: 300
  overseas_subscription:
    type: http
    url: "${overseas_sub_url}"
    interval: 3600
    health-check:
      enable: true
      url: "http://www.gstatic.com/generate_204"
      interval: 300
proxies = |
  - name: 🇨🇳回国节点
    type: ss
    server: ${CN_SERVER}
    port: ${CN_PORT}
    cipher: ${CN_ENCRYPTION}
    password: ${CN_PASSWORD}
    udp: true
    ipv6: true
  - name: 🌍海外节点
    type: trojan
    server: ${OVERSEAS_SERVER}
    port: ${OVERSEAS_PORT}
    password: ${OVERSEAS_PASSWORD}
    sni: ${OVERSEAS_SNI}
    udp: true
    ipv6: true
proxy-groups = |
  - name: 🇨🇳回国组
    type: url-test
    proxies:
      - backcn_subscription
      - 🌍海外节点
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
  - name: 🌍海外组
    type: url-test
    proxies:
      - overseas_subscription
      - 🇨🇳回国组
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
dns = |
  enable: true
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 114.114.114.114
  fallback:
    - https://dns.cloudflare.com/dns-query
  nameserver-policy:
    "geosite:cn": 114.114.114.114
backcn-rules = |
  - RULE-SET,lan,DIRECT
  - RULE-SET,geoip-cn,DIRECT
  - RULE-SET,geosite-cn,DIRECT
  - RULE-SET,alibaba,DIRECT
  - RULE-SET,tencent,DIRECT
  - RULE-SET,baidu,DIRECT
  - RULE-SET,gfw,🌍海外组
  - RULE-SET,banad,REJECT
  - RULE-SET,adblock_reject,REJECT
  - MATCH,🌍海外组
rule-providers = |
  lan: type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Lan.list", path: ./ruleset/lan.yaml, interval: 43200
  geoip-cn: type: http, behavior: classical, url: "https://raw.githubusercontent.com/Loyalsoldier/geoip/release/CN.txt", path: ./ruleset/geoip-cn.yaml, interval: 43200
  geosite-cn: type: http, behavior: classical, url: "https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/geosite-cn.dat", path: ./ruleset/geosite-cn.yaml, interval: 43200
  alibaba: type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Alibaba.list", path: ./ruleset/alibaba.yaml, interval: 43200
  tencent: type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Tencent.list", path: ./ruleset/tencent.yaml, interval: 43200
  baidu: type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Baidu.list", path: ./ruleset/baidu.yaml, interval: 43200
  banad: type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list", path: ./ruleset/banad.yaml, interval: 43200
  adblock_reject: type: http, behavior: domain, url: "https://raw.githubusercontent.com/REIJI007/AdBlock_Rule_For_Clash/main/adblock_reject.yaml", path: ./ruleset/adblock_reject.yaml, interval: 1200
  gfw: type: http, behavior: classical, url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/GreatFire.list", path: ./ruleset/gfw.yaml, interval: 43200
`;
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const search = url.search;
  const userAgentHeader = request.headers.get('User-Agent');
  const userAgent = userAgentHeader ? userAgentHeader.toLowerCase() : "null";

  // 从环境变量获取配置
  mytoken = env.TOKEN || mytoken;
  guestToken = env.GUESTTOKEN || env.GUEST || guestToken || await MD5MD5(mytoken);
  BotToken = env.TGTOKEN || BotToken;
  ChatID = env.TGID || ChatID;
  TG = env.TG || TG;
  const subConverter = env.SUBAPI || "subapi.cmliussss.net";
  const subProtocol = subConverter.includes("http://") ? 'http' : 'https';
  const subConfig = env.SUBCONFIG || "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_MultiCountry.ini";
  FileName = env.SUBNAME || FileName;
  SUBUpdateTime = env.SUBUPTIME || SUBUpdateTime;

  // 动态token验证
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  const timeTemp = Math.ceil(currentDate.getTime() / 1000);
  const fakeToken = await MD5MD5(`${mytoken}${timeTemp}`);
  const 访客订阅 = guestToken;

  let UD = Math.floor(((timestamp - Date.now()) / timestamp * total * 1099511627776) / 2);
  total = total * 1099511627776;
  let expire = Math.floor(timestamp / 1000);

  // KV存储INI
  const KV_NAMESPACE = 'SUB_INI_KV';
  const iniTemplate = await KV_NAMESPACE.get('backcn_ini') || getDefaultINI();

  // 权限验证
  if (!([mytoken, fakeToken, 访客订阅].includes(url.searchParams.get('token')) || path === `/${mytoken}` || path.includes(`/${mytoken}?`))) {
    if (TG == 1 && path !== "/" && path !== "/favicon.ico") {
      await sendMessage(`#异常访问 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}\n域名: ${url.hostname}\n入口: ${path + search}`);
    }
    return new Response(await nginx(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }

  // 处理订阅请求
  if (search.includes('url=')) {
    let subUrl = url.searchParams.get('url');
    if (subUrl) {
      try {
        subUrl = atob(subUrl);  // base64解码
      } catch (e) {
        return new Response('解码失败: ' + e.message, { status: 400 });
      }
    }

    // 转发到SUBAPI.cmliussss.net
    const subconverterUrl = `${subProtocol}://subapi.cmliussss.net/sub?target=clash&config=${encodeURIComponent(iniTemplate)}&url=${encodeURIComponent(subUrl)}`;

    const response = await fetch(subconverterUrl, {
      headers: { 'User-Agent': `${userAgentHeader} CF-Workers-SUB` }
    });
    if (!response.ok) {
      return new Response('转换失败: ' + response.statusText, { status: response.status });
    }

    let yaml = await response.text();

    // 注入自动测速
    yaml = yaml.replace(/type: select/g, 'type: url-test');
    yaml = yaml.replace(/interval: \d+/g, 'interval: 300');
    yaml = yaml.replace(/url: ""/g, 'url: "http://www.gstatic.com/generate_204"');
    yaml = yaml.replace(/tolerance: \d+/g, 'tolerance: 50');

    return new Response(yaml, {
      headers: {
        'Content-Type': 'text/yaml',
        'Access-Control-Allow-Origin': '*',
        'Profile-Update-Interval': `${SUBUpdateTime}`,
        'Profile-web-page-url': url.href.split('?')[0]
      }
    });
  }

  // 返回INI
  if (path === '/ini') {
    return new Response(iniTemplate, { headers: { 'Content-Type': 'text/plain' } });
  }

  // Web界面
  if (userAgent.includes('mozilla') && !search) {
    await sendMessage(`#编辑订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}\n域名: ${url.hostname}\n入口: ${path + search}`);
    return await KV(request, env, 'LINK.txt', 访客订阅);
  }

  // 健康检查
  return new Response('私有后端就绪，支持 /?url=base64(订阅)。示例: /ini 返回INI。', { status: 200 });
}

// 辅助函数 (从原脚本保留，精简注释)
async function ADD(envadd) {
  const addtext = envadd.replace(/[	"'|\r\n]+/g, '\n').replace(/\n+/g, '\n');
  return addtext.split('\n').filter(line => line.trim());
}

async function nginx() {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Welcome to nginx!</title>
    <style>body { width: 35em; margin: 0 auto; font-family: Tahoma, Verdana, Arial, sans-serif; }</style>
    </head>
    <body>
    <h1>Welcome to nginx!</h1>
    <p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p>
    <p>For online documentation and support please refer to <a href="http://nginx.org/">nginx.org</a>.<br/>
    Commercial support is available at <a href="http://nginx.com/">nginx.com</a>.</p>
    <p><em>Thank you for using nginx.</em></p>
    </body>
    </html>
  `;
}

async function sendMessage(type, ip, add_data = "") {
  if (BotToken && ChatID) {
    const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
    let msg = response.status == 200
      ? `${type}\nIP: ${ip}\n国家: ${(await response.json()).country}\n${add_data}`
      : `${type}\nIP: ${ip}\n${add_data}`;
    return fetch(`https://api.telegram.org/bot${BotToken}/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent(msg)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72' }
    });
  }
}

async function MD5MD5(text) {
  const encoder = new TextEncoder();
  const firstPass = await crypto.subtle.digest('MD5', encoder.encode(text));
  const firstHex = Array.from(new Uint8Array(firstPass)).map(b => b.toString(16).padStart(2, '0')).join('');
  const secondPass = await crypto.subtle.digest('MD5', encoder.encode(firstHex.slice(7, 27)));
  return Array.from(new Uint8Array(secondPass)).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

async function KV(request, env, txt = 'LINK.txt', guest) {
  const url = new URL(request.url);
  try {
    if (request.method === "POST") {
      if (!env.KV) return new Response("未绑定KV空间", { status: 400 });
      const content = await request.text();
      await env.KV.put(txt, content);
      return new Response("保存成功");
    }

    let content = env.KV ? await env.KV.get(txt) || '' : '';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${FileName} 订阅编辑</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { margin: 0; padding: 15px; box-sizing: border-box; font-size: 13px; }
          .editor-container { width: 100%; max-width: 100%; margin: 0 auto; }
          .editor { width: 100%; height: 300px; margin: 15px 0; padding: 10px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; line-height: 1.5; overflow-y: auto; resize: none; }
          .save-container { margin-top: 8px; display: flex; align-items: center; gap: 10px; }
          .save-btn, .back-btn { padding: 6px 15px; color: white; border: none; border-radius: 4px; cursor: pointer; }
          .save-btn { background: #4CAF50; }
          .save-btn:hover { background: #45a049; }
          .back-btn { background: #666; }
          .back-btn:hover { background: #555; }
          .save-status { color: #666; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/@keeex/qrcodejs-kx@1.0.2/qrcode.min.js"></script>
      </head>
      <body>
        ################################################################<br>
        Subscribe / sub 订阅地址, 点击链接自动 <strong>复制订阅链接</strong> 并 <strong>生成订阅二维码</strong><br>
        ---------------------------------------------------------------<br>
        自适应订阅地址:<br>
        <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?sub','qrcode_0')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}</a><br>
        <div id="qrcode_0" style="margin: 10px;"></div>
        Base64订阅地址:<br>
        <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?b64','qrcode_1')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?b64</a><br>
        <div id="qrcode_1" style="margin: 10px;"></div>
        clash订阅地址:<br>
        <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?clash','qrcode_2')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?clash</a><br>
        <div id="qrcode_2" style="margin: 10px;"></div>
        singbox订阅地址:<br>
        <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?sb','qrcode_3')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?sb</a><br>
        <div id="qrcode_3" style="margin: 10px;"></div>
        surge订阅地址:<br>
        <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?surge','qrcode_4')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?surge</a><br>
        <div id="qrcode_4" style="margin: 10px;"></div>
        loon订阅地址:<br>
        <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/${mytoken}?loon','qrcode_5')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/${mytoken}?loon</a><br>
        <div id="qrcode_5" style="margin: 10px;"></div>
        &nbsp;&nbsp;<strong><a href="javascript:void(0);" id="noticeToggle" onclick="toggleNotice()">查看访客订阅∨</a></strong><br>
        <div id="noticeContent" style="display: none;">
          ---------------------------------------------------------------<br>
          访客订阅只能使用订阅功能，无法查看配置页！<br>
          GUEST（访客订阅TOKEN）: <strong>${guestToken}</strong><br>
          ---------------------------------------------------------------<br>
          自适应订阅地址:<br>
          <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestToken}','guest_0')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestToken}</a><br>
          <div id="guest_0" style="margin: 10px;"></div>
          Base64订阅地址:<br>
          <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestToken}&b64','guest_1')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestToken}&b64</a><br>
          <div id="guest_1" style="margin: 10px;"></div>
          clash订阅地址:<br>
          <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestToken}&clash','guest_2')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestToken}&clash</a><br>
          <div id="guest_2" style="margin: 10px;"></div>
          singbox订阅地址:<br>
          <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestToken}&sb','guest_3')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestToken}&sb</a><br>
          <div id="guest_3" style="margin: 10px;"></div>
          surge订阅地址:<br>
          <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestToken}&surge','guest_4')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestToken}&surge</a><br>
          <div id="guest_4" style="margin: 10px;"></div>
          loon订阅地址:<br>
          <a href="javascript:void(0)" onclick="copyToClipboard('https://${url.hostname}/sub?token=${guestToken}&loon','guest_5')" style="color:blue;text-decoration:underline;cursor:pointer;">https://${url.hostname}/sub?token=${guestToken}&loon</a><br>
          <div id="guest_5" style="margin: 10px;"></div>
        </div>
        ---------------------------------------------------------------<br>
        ################################################################<br>
        订阅转换配置<br>
        ---------------------------------------------------------------<br>
        SUBAPI（订阅转换后端）: <strong>${subProtocol}://subapi.cmliussss.net</strong><br>
        SUBCONFIG（订阅转换配置文件）: <strong>${subConfig}</strong><br>
        ---------------------------------------------------------------<br>
        ################################################################<br>
        ${FileName} 汇聚订阅编辑:
        <div class="editor-container">
          ${env.KV ? `<textarea class="editor" placeholder="请输入订阅链接" id="content">${content}</textarea>
          <div class="save-container">
            <button class="save-btn" onclick="saveContent(this)">保存</button>
            <span class="save-status" id="saveStatus"></span>
          </div>` : '<p>请绑定 <strong>变量名称</strong> 为 <strong>KV</strong> 的KV命名空间</p>'}
        </div>
        <br>
        ################################################################<br>
        telegram 交流群 技术群 支持分享<br>
        <a href="https://t.me/CMLiussss">https://t.me/CMLiussss</a><br>
        --------------------------------<br>
        github 项目地址 Star!Star!Star!!!<br>
        <a href="https://github.com/cmliu/CF-Workers-SUB">https://github.com/cmliu/CF-Workers-SUB</a><br>
        --------------------------------<br>
        ################################################################<br>
        <br><br>UA: <strong>${userAgentHeader}</strong>
        <script>
        function copyToClipboard(text, qrcode) {
          navigator.clipboard.writeText(text).then(() => {
            alert('已复制到剪贴板');
          }).catch(err => {
            console.error('复制失败:', err);
          });
          const qrcodeDiv = document.getElementById(qrcode);
          qrcodeDiv.innerHTML = '';
          new QRCode(qrcodeDiv, {
            text: text,
            width: 220,
            height: 220,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.Q
          });
        }

        if (document.querySelector('.editor')) {
          let timer;
          const textarea = document.getElementById('content');
          const originalContent = textarea.value;

          function goBack() {
            const currentUrl = window.location.href;
            const parentUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/'));
            window.location.href = parentUrl;
          }

          function replaceFullwidthColon() {
            const text = textarea.value;
            textarea.value = text.replace(/：/g, ':');
          }

          function saveContent(button) {
            try {
              const updateButtonText = (step) => {
                button.textContent = `保存中: ${step}`;
              };
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
              if (!isIOS) {
                replaceFullwidthColon();
              }
              updateButtonText('开始保存');
              button.disabled = true;

              const textarea = document.getElementById('content');
              if (!textarea) {
                throw new Error('找不到文本编辑区域');
              }

              updateButtonText('获取内容');
              let newContent = textarea.value || '';
              let originalContent = textarea.defaultValue || '';

              updateButtonText('准备状态更新函数');
              const updateStatus = (message, isError = false) => {
                const statusElem = document.getElementById('saveStatus');
                if (statusElem) {
                  statusElem.textContent = message;
                  statusElem.style.color = isError ? 'red' : '#666';
                }
              };

              updateButtonText('准备按钮重置函数');
              const resetButton = () => {
                button.textContent = '保存';
                button.disabled = false;
              };

              if (newContent !== originalContent) {
                updateButtonText('发送保存请求');
                fetch(window.location.href, {
                  method: 'POST',
                  body: newContent,
                  headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                  cache: 'no-cache'
                })
                .then(response => {
                  updateButtonText('检查响应状态');
                  if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                  }
                  updateButtonText('更新保存状态');
                  const now = new Date().toLocaleString();
                  document.title = `编辑已保存 ${now}`;
                  updateStatus(`已保存 ${now}`);
                })
                .catch(error => {
                  updateButtonText('处理错误');
                  console.error('Save error:', error);
                  updateStatus(`保存失败: ${error.message}`, true);
                })
                .finally(() => {
                  resetButton();
                });
              } else {
                updateButtonText('检查内容变化');
                updateStatus('内容未变化');
                resetButton();
              }
            } catch (error) {
              console.error('保存过程出错:', error);
              button.textContent = '保存';
              button.disabled = false;
              const statusElem = document.getElementById('saveStatus');
              if (statusElem) {
                statusElem.textContent = `错误: ${error.message}`;
                statusElem.style.color = 'red';
              }
            }
          }

          textarea.addEventListener('blur', saveContent);
          textarea.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(saveContent, 5000);
          });
        }

        function toggleNotice() {
          const noticeContent = document.getElementById('noticeContent');
          const noticeToggle = document.getElementById('noticeToggle');
          if (noticeContent.style.display === 'none' || noticeContent.style.display === '') {
            noticeContent.style.display = 'block';
            noticeToggle.textContent = '隐藏访客订阅∧';
          } else {
            noticeContent.style.display = 'none';
            noticeToggle.textContent = '查看访客订阅∨';
          }
        }

        document.addEventListener('DOMContentLoaded', () => {
          document.getElementById('noticeContent').style.display = 'none';
        });
        </script>
      </body>
    </html>
    `;
  } catch (error) {
    console.error('处理请求时发生错误:', error);
    return new Response("服务器错误: " + error.message, {
      status: 500,
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
  }
}
