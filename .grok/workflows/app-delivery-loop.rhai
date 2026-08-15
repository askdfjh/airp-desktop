let meta = #{
    name: "app-delivery-loop",
    description: "DEPRECATED stub. Use app-ship-loop. Exits immediately and does not edit the repo.",
    when_to_use: "Do not use. Replaced by app-ship-loop.",
    phases: [
        #{ title: "Queue", detail: "refuse to run the old 10-task loop" },
    ],
};

phase("Queue");
log("app-delivery-loop is retired. Launch app-ship-loop instead. This stub does not spawn implementers.");
complete(#{
    deprecated: true,
    next_workflow: "app-ship-loop",
    reason: "Old loop re-implemented finished tasks and two copies shared one workspace.",
});
