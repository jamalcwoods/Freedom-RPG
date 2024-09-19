module.exports = {
    config:{},
    data:{
        name:"deleteMessage"
    },
    execute(interaction,componentConfig,callback){
        if(componentConfig.args){
            if(componentConfig.args[0] == interaction.user.id){
                interaction.message.delete()
            } else {
                interaction.reply({content: "This message must be dismissed by the user it is addressing",ephemeral:true})
            }
        } else {
            interaction.message.delete()
        }
        callback({})
    }
}