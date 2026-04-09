import { BaseWorker } from "nomo/entrypoints";
import { Router } from "nomo/router";
import { HomeController } from "./controllers/home";
import { DocsController } from "./controllers/docs";
import type { Env } from "./types";

export * from "./controllers/home";
export * from "./controllers/docs";

class DocsRouter extends Router<Env> {
  constructor() {
    super();

    this.get("/", HomeController.index);
    this.get("/docs", DocsController.index);
    this.get("/docs/:page", DocsController.page);
    this.get("/api", DocsController.api);
    this.get("/examples", DocsController.examples);
    this.get("/getting-started", DocsController.gettingStarted);
    this.get("/architecture", DocsController.architecture);
    this.get("/packages/:package", DocsController.packageDocs);

    this.get("/assets/prism.css", async () => {
      return new Response(PRISM_CSS, {
        headers: { "Content-Type": "text/css" },
      });
    });

    this.get("/assets/prism.js", async () => {
      return new Response(PRISM_JS, {
        headers: { "Content-Type": "application/javascript" },
      });
    });

    this.onError((err, _req, _env, ctx) => {
      ctx.logger.error("Docs site error", { error: err.message, path: _req.url });
      return ctx.html(ERROR_PAGE, { status: 500 });
    });
  }
}

const router = new DocsRouter();

export default class DocsSite extends BaseWorker<Env> {
  router = router;
}

const PRISM_CSS = `/* PrismJS theme */
code[class*="language-"],pre[class*="language-"]{color:#f8f8f2;text-shadow:0 1px rgba(0,0,0,0.3);font-family:Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace;font-size:14px;text-align:left;white-space:pre;word-spacing:normal;word-break:normal;word-wrap:normal;line-height:1.5;tab-size:4;hyphens:none}
pre[class*="language-"]{padding:1em;margin:.5em 0;overflow:auto;border-radius:.3em}
:not(pre)>code[class*="language-"]{padding:.1em;border-radius:.3em;white-space:normal}
.token.comment,.token.prolog,.token.doctype,.token.cdata{color:#aaa}
.token.punctuation{color:#f8f8f2}
.token.namespace{opacity:.7}
.token.property,.token.tag,.token.constant,.token.symbol,.token.deleted{color:#f92672}
.token.boolean,.token.number{color:#ae81ff}
.token.selector,.token.attr-name,.token.string,.token.char,.token.builtin,.token.inserted{color:#a6e22e}
.token.operator,.token.entity,.token.url,.language-css .token.string,.style .token.string,.token.variable{color:#f8f8f2}
.token.atrule,.token.attr-value,.token.function,.token.class-name{color:#e6db74}
.token.keyword{color:#66d9ef}
.token.regex,.token.important{color:#fd971f}
.token.important,.token.bold{font-weight:bold}
.token.italic{font-style:italic}
.token.entity{cursor:help}`;

const PRISM_JS = `/* PrismJS */
var _self="undefined"!=typeof window?window:"undefined"!=typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope?self:{},Prism=function(){var e=/\\blang(?:uage)?-(\\w+)\\b/i,t=window.Prism={manual:!0,languages:{insertBefore:function(e,t,n,r){var a=r||Prism.languages[e];Prism.languages[e]=a;for(var o in n)if(n.hasOwnProperty(o)){var i=n[o],s=a[o];a[o]=i,s&&(i.before=s)}}},plugins:{},highlight:function(e,t,n){var r={code:e,grammar:t,language:n};return Prism.hooks.run("before-highlight",r),r.code=Prism.highlight(r.code,r.grammar,r.language),Prism.hooks.run("after-highlight",r),r.code},hooks:{onBeforeHighlight:function(e){var t=e.element.parentNode;if(t&&/pre/i.test(t.nodeName)&&!t.hasAttribute("data-manual")){var n=Prism.util.getLanguage(e.element);if(n){t.setAttribute("data-language",n)}}},onBeforeTokenize:function(e){e.grammar=Prism.util.getLanguage(e.element)||{}};return Prism}();`;

const ERROR_PAGE = `<!DOCTYPE html>
<html>
<head><title>Error - Nomo Docs</title></head>
<body><h1>500 Internal Server Error</h1><p>Something went wrong.</p></body>
</html>`;
