using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ScreenCastApp
{
    public class ScreenCastHub : Hub
    {
        public ConcurrentDictionary<string, object> _casters = new ConcurrentDictionary<string, object>();
        public ConcurrentDictionary<string, object> _viewers = new ConcurrentDictionary<string, object>();

        public ScreenCastHub()
        {

        }

        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
            await AddScreenCastViewer();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            await base.OnDisconnectedAsync(exception);
            await RemoveScreenCastViewer();
        }

        public IEnumerable<string> GetStreamCasters()
        {
            return _casters.Keys;
        }

        public async Task AddScreenCastAgent()
        {
            _casters.TryAdd(Context.ConnectionId, null);
            await Clients.Others.SendAsync("NewScreenCastAgent");
        }

        public async Task RemoveScreenCastAgent()
        {
            _casters.TryRemove(Context.ConnectionId, out var _);
            await Clients.Others.SendAsync("RemoveScreenCastAgent");
        }

        public async Task AddScreenCastViewer()
        {
            _viewers.TryAdd(Context.ConnectionId, null);
            await Clients.Others.SendAsync("NewViewer");
        }

        public async Task RemoveScreenCastViewer()
        {
            _viewers.TryRemove(Context.ConnectionId, out var _);
            await Clients.All.SendAsync("NoViewer");
        }

        public async Task StreamCastData(IAsyncEnumerable<string> stream)
        {
            await foreach (var item in stream)
            {
                await Clients.Others.SendAsync("OnStreamCastDataReceived", item);
            }
        }
    }
}
