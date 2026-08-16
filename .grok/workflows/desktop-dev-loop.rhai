let meta = #{
    name: "desktop-dev-loop",
    description: "vdnight desktop loop: static test, live window pass, one fix, ship exe via DWS",
    when_to_use: "Desktop shelf work on vdnight. Never launch a second copy. Do not use app-delivery-loop.",
    phases: [
        #{ title: "Detect", detail: "confirm vdnight, refuse dual runs" },
        #{ title: "Static", detail: "tsc and core parser tests" },
        #{ title: "Live", detail: "launch exe and walk the desktop UI" },
        #{ title: "Fix", detail: "at most one repair round" },
        #{ title: "Ship", detail: "commit, push vdnight, tauri build, DWS" },
    ],
};

let detect_schema = #{
    "type": "object",
    "properties": #{
        "branch": #{ "type": "string" },
        "other_loop": #{ "type": "boolean" },
        "ready": #{ "type": "boolean" },
        "notes": #{ "type": "string" },
    },
};

let test_schema = #{
    "type": "object",
    "properties": #{
        "passed": #{ "type": "boolean" },
        "log": #{ "type": "string" },
    },
};

let live_schema = #{
    "type": "object",
    "properties": #{
        "ok": #{ "type": "boolean" },
        "blockers": #{ "type": "string" },
        "notes": #{ "type": "string" },
    },
};

let exec_schema = #{
    "type": "object",
    "properties": #{
        "status": #{ "type": "string" },
        "summary": #{ "type": "string" },
    },
};

fn text_of(v) {
    if v == () {
        ""
    } else if type_of(v) == "string" {
        v
    } else {
        json_encode(v)
    }
}

fn ok_out(r) {
    r != () && r.success && r.output != ()
}

fn rules() {
    let s = "";
    s += "Workspace: F:\\DocProject\\airp-desktop. Stay on branch vdnight. Never touch master. ";
    s += "Never start a second desktop-dev-loop. Never launch app-delivery-loop. ";
    s += "APP features already exist; do not rewrite bookshelf or storyTitle. ";
    s += "Desktop must clear the 40px title bar. Use tools. Do not answer from memory. ";
    s += "Do not use isolation worktrees. No emoji in product UI.\n";
    s
}

let do_package = true;
let do_send = true;
if args != () {
    if args.skip_package == true { do_package = false; }
    if args.skip_send == true { do_send = false; }
}

phase("Detect");
let dprompt = rules();
dprompt += "DETECT only. Run git branch --show-current and git status. ";
dprompt += "ready=true if branch is vdnight and Bookshelf.tsx plus useDesktopHotkeys.ts exist. ";
dprompt += "other_loop=true if another implementer is rewriting the same desktop files. ";
dprompt += "Do not edit files.\n";
let dres = agent(dprompt, #{
    label: "detect",
    capability_mode: "read-only",
    output_schema: detect_schema,
});
let other = false;
if ok_out(dres) {
    if dres.output.other_loop == true { other = true; }
}
if other {
    complete(#{ stopped: true, reason: "another loop is writing the workspace" });
}

phase("Static");
let tprompt = rules();
tprompt += "STATIC TEST. In F:\\DocProject\\airp-desktop run: node scripts/test-core.mjs then npx tsc --noEmit. ";
tprompt += "passed=true only if both exit 0. Put command output in log. Do not claim pass without running.\n";
let tres = agent(tprompt, #{
    label: "static",
    capability_mode: "execute",
    output_schema: test_schema,
});
let static_ok = true;
if ok_out(tres) {
    static_ok = tres.output.passed == true;
}

phase("Live");
let lprompt = rules();
lprompt += "LIVE DESKTOP TEST. Launch via orca terminal create --worktree path:F:/DocProject/airp-desktop --title narra-live --command src-tauri\\target\\x86_64-pc-windows-msvc\\release\\airp-desktop.exe. Do not use Start-Process. ";
lprompt += "Then orca computer list-apps, list-windows --app airp-desktop, get-app-state --app airp-desktop --restore-window. ";
lprompt += "Walk: bookshelf below title bar; open start flow; Esc back; open settings and confirm all tabs; Esc back. ";
lprompt += "If welcome is visible, copy must say 本地文字创作与排版 and 跳过，先去书架, never 进入对话. ";
lprompt += "ok=true only if you operated the real window and saw no blocker. blockers = concrete UI bugs. ";
lprompt += "If orca cannot see the window, ok=false and say so in notes. Do not invent a pass.\n";
let lres = agent(lprompt, #{
    label: "live",
    capability_mode: "all",
    output_schema: live_schema,
});
let live_ok = true;
let blockers = "";
if ok_out(lres) {
    live_ok = lres.output.ok == true;
    blockers = text_of(lres.output.blockers);
} else {
    live_ok = false;
    blockers = "live agent failed";
}

phase("Fix");
let needs_fix = false;
if !static_ok { needs_fix = true; }
if !live_ok { needs_fix = true; }
if blockers != "" && blockers != "none" && blockers != "无" { needs_fix = true; }

if needs_fix {
    log("One desktop fix round");
    let fprompt = rules();
    fprompt += "FIX only static failures and live blockers. Do not restyle the phone layout. ";
    fprompt += "blockers: " + blockers + "\n";
    fprompt += "Then run npx tsc --noEmit. status done or blocked.\n";
    let fres = agent(fprompt, #{
        label: "fix",
        capability_mode: "all",
        output_schema: exec_schema,
    });
    let t2 = rules();
    t2 += "Re-run node scripts/test-core.mjs and npx tsc --noEmit. passed=true only if both exit 0.\n";
    let tres2 = agent(t2, #{
        label: "retest",
        capability_mode: "execute",
        output_schema: test_schema,
    });
    if ok_out(tres2) { static_ok = tres2.output.passed == true; }
    if ok_out(fres) {
        if text_of(fres.output.status) == "blocked" { static_ok = false; }
    }
}

if !static_ok {
    complete(#{ stopped: true, reason: "static or fix still failing", blockers: blockers });
}

phase("Ship");
let cprompt = rules();
cprompt += "If there are uncommitted desktop src/ or docs changes, commit on vdnight. ";
cprompt += "Do not commit package-lock noise or gen/android intermediates. ";
cprompt += "Push origin vdnight. status done if clean or pushed.\n";
let cres = agent(cprompt, #{
    label: "commit",
    capability_mode: "all",
    output_schema: exec_schema,
});

if do_package {
    let pprompt = rules();
    pprompt += "PACKAGE desktop. Set CARGO_HOME=C:\\ux-home\\.cargo and RUSTUP_HOME=C:\\rustup. ";
    pprompt += "Run npm run tauri:build. Copy nsis setup exe to releases/Narra_*_x64-setup.exe. ";
    pprompt += "Record SHA-256. status done only if the exe exists.\n";
    let pres = agent(pprompt, #{
        label: "package",
        capability_mode: "all",
        output_schema: exec_schema,
    });
    if ok_out(pres) {
        if text_of(pres.output.status) != "done" {
            complete(#{ stopped: true, reason: "package failed", detail: text_of(pres.output.summary) });
        }
    }
}

if do_send {
    let sprompt = rules();
    sprompt += "SEND via dws. Upload releases/Narra_*_x64-setup.exe to openDingTalkId DXx72diSEZI81ODBmzDo75KfvNBmKDY8UT. ";
    sprompt += "Then chat message send --msg-type file with dentry-id space-id file-path file-size. ";
    sprompt += "Then send a short text: desktop loop result + SHA-256. status done if both send.\n";
    let sres = agent(sprompt, #{
        label: "send",
        capability_mode: "all",
        output_schema: exec_schema,
    });
    if ok_out(sres) {
        log("send: " + text_of(sres.output.summary));
    }
}

complete(#{
    branch: "vdnight",
    static_ok: static_ok,
    live_ok: live_ok,
    blockers: blockers,
    shipped: do_package,
});
