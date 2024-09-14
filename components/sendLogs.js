const { MessageAttachment } = require('discord.js');

module.exports = {
    config:{
        getSession:true,
        onlySessionID:true
    },
    data:{
        name:"sendLogs"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let file;
        if(session.session_id){
            file = new MessageAttachment('./logs/' + session.session_id + '.json');
        } else {
            file = new MessageAttachment('./logs/' + session + '.json');
        }

        interaction.reply({
            content: " ",
            ephemeral: true,
            files: [file]
        })

        callback({})
    }
}