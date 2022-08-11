const { executeFromSession }= require("../components/questChoice");

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"continueQuest"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let tempSession = session.session_data.options.quest.session
        let tempCallback = session.session_data.options.quest.callback
        session.session_data.options.quest.session.session_data.quest.winner = session.session_data.winners[0]
        executeFromSession(
            interaction,
            tempSession,
            tempCallback
        )
        callback({
            removeSession:session
        })
    }
}