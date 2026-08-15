let meta = #{
    name: "app-ship-loop",
    description: "Single-flight APP ship: skip finished work, review, test, one fix, commit, APK, DWS send",
    when_to_use: "Ship APP work that is already in the tree. Never launch a second copy. Do not use app-delivery-loop.",
    phases: [
        #{ title: "Detect", detail: "skip finished features, refuse dual runs" },
        #{ title: "Review-Test", detail: "parallel review and tsc" },
        #{ title: "Fix", detail: "at most one repair round" },
        #{ title: "Commit", detail: "commit and push APP only" },
        #{ title: "Package", detail: "embed frontend in .so and assemble APK" },
        #{ title: "Send", detail: "DWS private chat to 于翔" },
    ],
};

let detect_schema = #{
    "type": "object",
    "properties": #{
        "ready_to_ship": #{ "type": "boolean" },
        "gaps": #{ "type": "string" },
        "branch": #{ "type": "string" },
        "other_loop": #{ "type": "boolean" },
    },
};

let review_schema = #{
    "type": "object",
    "properties": #{
        "verdict": #{ "type": "string" },
        "blockers": #{ "type": "string" },
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

let exec_schema = #{
    "type": "object",
    "properties": #{
        "status": #{ "type": "string" },
        "summary": #{ "type": "string" },
    },
};

let ship_schema = #{
    "type": "object",
    "properties": #{
        "ok": #{ "type": "boolean" },
        "path": #{ "type": "string" },
        "detail": #{ "type": "string" },
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
    s += "Workspace: F:\\DocProject\\airp-desktop. Stay on branch APP. Never touch master. ";
    s += "Never launch app-delivery-loop. Never start a second app-ship-loop. ";
    s += "If bookshelf and storyTitle already exist, do not re-implement P0/P1. ";
    s += "Frontend on Android is embedded in the .so by generate_context!; copying assets is not enough. ";
    s += "Use tools. Do not answer from memory. Do not use isolation worktrees.\n";
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
dprompt += "DETECT only. Read git status, git log -8, and check these exist: ";
dprompt += "src/stores/storyStore.ts, src/components/Bookshelf/Bookshelf.tsx, src/lib/storyTitle.ts. ";
dprompt += "ready_to_ship=true if APP branch has bookshelf + auto title and you must NOT rewrite finished tasks. ";
dprompt += "gaps = remaining real bugs only. other_loop=true if you see another implementer rewriting the same files. ";
dprompt += "If other_loop, do not edit anything.\n";
let dres = agent(dprompt, #{
    label: "detect",
    capability_mode: "read-only",
    output_schema: detect_schema,
});
let ready = true;
let other = false;
let gaps = "";
if ok_out(dres) {
    if dres.output.ready_to_ship == false { ready = false; }
    if dres.output.other_loop == true { other = true; }
    gaps = text_of(dres.output.gaps);
}
if other {
    complete(#{ stopped: true, reason: "another loop is writing the workspace" });
}

phase("Review-Test");
let rprompt = rules();
rprompt += "CODE REVIEW the current APP tree vs origin/APP and uncommitted src/. ";
rprompt += "Focus storyTitle, storyStore.autoTitle, Bookshelf, BookDetail, useChat auto title hook. ";
rprompt += "verdict approve or changes. blockers = real bugs only. Empty blockers only after reading files.\n";
if gaps != "" { rprompt += "Detect gaps: " + gaps + "\n"; }
let tprompt = rules();
tprompt += "TEST. In F:\\DocProject\\airp-desktop run: git branch --show-current, then npx tsc --noEmit. ";
tprompt += "passed=true only if tsc exit 0. Put command output in log. Do not claim pass without running.\n";
let panel = parallel([
    #{
        prompt: rprompt,
        label: "review",
        capability_mode: "read-only",
        output_schema: review_schema,
    },
    #{
        prompt: tprompt,
        label: "test",
        capability_mode: "execute",
        output_schema: test_schema,
    },
]);

let verdict = "approve";
let blockers = "";
let test_ok = true;
if panel.len() > 0 && ok_out(panel[0]) {
    verdict = text_of(panel[0].output.verdict);
    blockers = text_of(panel[0].output.blockers);
    if verdict == "" { verdict = "approve"; }
}
if panel.len() > 1 && ok_out(panel[1]) {
    test_ok = panel[1].output.passed == true;
}

let needs_fix = false;
if !ready { needs_fix = true; }
if verdict == "changes" { needs_fix = true; }
if !test_ok { needs_fix = true; }
if blockers != "" && blockers != "none" && blockers != "无" { needs_fix = true; }

phase("Fix");
if needs_fix {
    log("One fix round");
    let fprompt = rules();
    fprompt += "FIX only the blockers and tsc failures. Do not re-open finished bookshelf tasks.\n";
    fprompt += "Review verdict: " + verdict + " blockers: " + blockers + "\n";
    fprompt += "Then run npx tsc --noEmit. status done or blocked.\n";
    let fres = agent(fprompt, #{
        label: "fix",
        capability_mode: "all",
        output_schema: exec_schema,
    });
    let t2 = rules();
    t2 += "Re-run npx tsc --noEmit. passed=true only if exit 0.\n";
    let tres = agent(t2, #{
        label: "retest",
        capability_mode: "execute",
        output_schema: test_schema,
    });
    if ok_out(tres) { test_ok = tres.output.passed == true; }
    if ok_out(fres) {
        if text_of(fres.output.status) == "blocked" { test_ok = false; }
    }
}

if !test_ok {
    complete(#{ stopped: true, reason: "tsc or blockers remain", verdict: verdict, blockers: blockers });
}

phase("Commit");
let cprompt = rules();
cprompt += "If there are uncommitted src/ or docs/app changes for this ship, commit them on APP. ";
cprompt += "Do not commit package-lock noise, .grok scratch, or gen/android intermediates unless required. ";
cprompt += "If ahead of origin/APP, git push origin APP. status done if clean or pushed.\n";
let cres = agent(cprompt, #{
    label: "commit",
    capability_mode: "all",
    output_schema: exec_schema,
});
let commit_sum = "";
if ok_out(cres) { commit_sum = text_of(cres.output.summary); }

let apk_path = "";
let apk_ok = !do_package;
if do_package {
    phase("Package");
    let pprompt = rules();
    pprompt += "Build a new arm64 release APK with the CURRENT frontend embedded. Follow AGENTS.md. ";
    pprompt += "NDK 27 is at C:\\Android\\sdk\\ndk\\27.0.12077973. Set CC/AR/LINKER/RANLIB for aarch64-linux-android24. ";
    pprompt += "RUSTUP_HOME=C:\\rustup and cargo from C:\\ux-home\\.cargo\\bin. ";
    pprompt += "1) npm run build  2) cargo build --release --target aarch64-linux-android ";
    pprompt += "3) copy libairp_desktop_lib.so into gen/android/app/src/main/jniLibs/arm64-v8a ";
    pprompt += "4) gradlew.bat clean assembleArm64Release with -Pairp.android.allowDebugReleaseSigning=true ";
    pprompt += "and -x rustBuildArm64Release -x rustBuildUniversalRelease --no-daemon. ";
    pprompt += "Bump patch version first (package.json, tauri.conf.json, Cargo.toml, tauri.properties versionCode+1). ";
    pprompt += "Copy APK to releases/Narra_<version>_android-arm64.apk and sha256 it. ";
    pprompt += "ok=true only if the APK file exists. path=absolute apk path. detail=sha256 and size.\n";
    let pres = agent(pprompt, #{
        label: "package",
        capability_mode: "all",
        output_schema: ship_schema,
    });
    if ok_out(pres) {
        apk_ok = pres.output.ok == true;
        apk_path = text_of(pres.output.path);
    }
    if !apk_ok {
        complete(#{ stopped: true, reason: "apk package failed", commit: commit_sum });
    }
}

let send_ok = !do_send;
if do_send {
    phase("Send");
    let sprompt = rules();
    sprompt += "Send the APK to 于翔 via dws private chat. Use only dws CLI with --format json. ";
    sprompt += "aisearch person --keyword 于翔 --dimension name. ";
    sprompt += "conversation-info --open-dingtalk-id. drive upload to newCSpaceIdIM. ";
    sprompt += "drive info for dentryId. chat message send text then --msg-type file. ";
    sprompt += "APK path: " + apk_path + "\n";
    sprompt += "ok=true only if send returns success. detail=openTaskId.\n";
    let sres = agent(sprompt, #{
        label: "send",
        capability_mode: "all",
        output_schema: ship_schema,
    });
    if ok_out(sres) { send_ok = sres.output.ok == true; }
}

let report = "# APP ship loop\n\n";
report += "commit: " + commit_sum + "\n";
report += "apk: " + apk_path + "\n";
report += "sent: " + send_ok.to_string() + "\n";
let rpath = write_scratch_file("ship-report.md", report);
complete(#{
    report: rpath,
    apk: apk_path,
    sent: send_ok,
    commit: commit_sum,
});
