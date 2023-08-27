module.exports = {
    config:{},
    data:{
        name:"deleteMessage"
    },
    execute(interaction,componentConfig,callback){
        interaction.message.delete()

        callback({})
    }
}