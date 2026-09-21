use crate::{
    framework::{
        ToolCtx, ToolExecResult, ToolResult, error_result, parse_args, pending_dialog_result,
        text_result,
    },
    jobs,
};
use browseros_core::PageId;
use futures_util::future::BoxFuture;
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::{Value, json};

const DESCRIPTION: &str = "\
Poll a `run` or `evaluate` job that outlived the 30s cap. Pass the `jobId` returned when a call came back with status `running`. \
If the job was started inside a page (`evaluate`), also pass `page`. Keep polling until `status` is `done` or `error`.";

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct PollArgs {
    /// Job id returned by `run` or `evaluate` when work continued past the cap.
    job_id: String,
    /// Page id, required to read an in-page evaluate job.
    #[serde(default)]
    page: Option<u32>,
}

pub fn definition() -> crate::framework::ToolDef {
    super::def::<PollArgs>(
        "poll",
        DESCRIPTION,
        Some(super::read_only_annotations()),
        handler,
    )
}

fn handler<'a>(
    raw: Value,
    ctx: &'a ToolCtx,
    _response: &'a mut crate::response::ToolResponse,
) -> BoxFuture<'a, ToolExecResult<Option<ToolResult>>> {
    Box::pin(async move {
        let args: PollArgs = parse_args(raw)?;
        let job_id = args.job_id.trim();
        if job_id.is_empty() {
            return Ok(Some(error_result("poll: jobId is required".to_string())));
        }
        if let Some(job) = jobs::lookup(job_id) {
            let structured = job.to_json();
            return Ok(Some(text_result(
                format!("{}", structured),
                Some(structured),
            )));
        }
        let Some(page_id) = args.page else {
            return Ok(Some(error_result(format!(
                "poll: unknown jobId {job_id}. If this was an evaluate job, pass `page` as well."
            ))));
        };
        if let Some(result) = pending_dialog_result(ctx, PageId(page_id)) {
            return Ok(Some(result));
        }
        let page = ctx.session.pages.get_session(PageId(page_id)).await?;
        let expression = format!(
            "(function() {{ var t = globalThis.__browserosJobs && globalThis.__browserosJobs[{id}]; return t || {{ jobId: {id}, status: 'unknown' }}; }})()",
            id = serde_json::to_string(job_id).unwrap_or_else(|_| "\"\"".to_string())
        );
        let result: Value = page
            .session
            .send(
                "Runtime.evaluate",
                json!({
                    "expression": expression,
                    "returnByValue": true,
                    "awaitPromise": false
                }),
            )
            .await?;
        let value = result
            .pointer("/result/value")
            .cloned()
            .unwrap_or(json!({ "jobId": job_id, "status": "unknown" }));
        Ok(Some(text_result(
            format!("{value}"),
            Some(value),
        )))
    })
}
