# Debug Events và RPC Compatibility

## Vấn đề với Base Sepolia

Base Sepolia RPC node (`https://sepolia.base.org`) có một số hạn chế:

- Không hỗ trợ đầy đủ các phương thức event filtering
- Thường xuyên gặp lỗi "filter not found" hoặc "Missing or invalid parameters"
- Event watching không hoạt động ổn định

## Giải pháp đã triển khai

### 1. RPC Capabilities Detection

- Hook `useRpcCapabilities()` tự động kiểm tra khả năng hỗ trợ event filtering
- Nếu RPC không hỗ trợ, tự động chuyển sang manual polling

### 2. Enhanced Error Handling

- Xử lý lỗi "filter not found" một cách thông minh
- Tự động chuyển sang manual polling khi event watching thất bại
- Retry logic với exponential backoff

### 3. Manual Polling Fallback

- Polling tự động với retry logic
- Tối đa 10 lần thử với delay tăng dần
- Fallback cuối cùng sử dụng `debugTransaction`

### 4. Smart Event Watching

- Chỉ watch events khi RPC hỗ trợ
- Tự động disable event watching khi gặp lỗi
- Graceful degradation từ event watching sang manual polling

## Cách sử dụng

### Trong component:

```tsx
const {
  handleStartSpin,
  isSpinning,
  spinResult,
  supportsEventFiltering,
  useManualPolling,
  eventWatchingFailed,
} = useSlotMachineContract();

// Hiển thị trạng thái RPC
if (supportsEventFiltering === false) {
  console.log("RPC không hỗ trợ event filtering, sử dụng manual polling");
}

// Hiển thị trạng thái fallback
if (useManualPolling) {
  console.log("Đang sử dụng manual polling thay vì event watching");
}
```

### Debug transaction:

```tsx
const { debugTransaction, isDebugging } = useEventDebugger();

// Debug một transaction cụ thể
debugTransaction("0x...");

// Kiểm tra trạng thái debug
if (isDebugging) {
  console.log("Đang debug transaction...");
}
```

## Log Messages

### Event Watching:

- `🎯 PayoutCalculated event received:` - Event được nhận thành công
- `❌ Error watching [EventName] events:` - Lỗi khi watch event
- `🔄 Event watching failed, switching to manual polling...` - Chuyển sang manual polling

### Manual Polling:

- `🔍 Polling for events manually... (attempt X/Y)` - Bắt đầu polling
- `⏰ Scheduling next poll in Xms...` - Lên lịch poll tiếp theo
- `🎉 Successfully decoded spin result from logs:` - Decode thành công

### RPC Capabilities:

- `🔍 Checking RPC node capabilities...` - Đang kiểm tra RPC
- `✅ RPC node supports event filtering` - RPC hỗ trợ event filtering
- `❌ RPC node does not support event filtering` - RPC không hỗ trợ

## Troubleshooting

### Nếu gặp lỗi "filter not found":

1. Hệ thống sẽ tự động chuyển sang manual polling
2. Kiểm tra console để xem trạng thái fallback
3. Manual polling sẽ retry tối đa 10 lần

### Nếu manual polling cũng thất bại:

1. Sử dụng `debugTransaction()` để debug thủ công
2. Kiểm tra transaction hash trên Base Sepolia explorer
3. Xem logs trong console để debug

### Để force manual polling:

```tsx
// Trong component
const [forceManualPolling, setForceManualPolling] = useState(false);

useEffect(() => {
  if (forceManualPolling) {
    setUseManualPolling(true);
    setEventWatchingFailed(true);
  }
}, [forceManualPolling]);
```

## Performance Considerations

- Manual polling sử dụng nhiều RPC calls hơn
- Delay giữa các lần poll tăng dần để giảm tải
- Tối đa 10 lần thử để tránh infinite loop
- Event watching được ưu tiên khi RPC hỗ trợ

## Future Improvements

1. **WebSocket Support**: Sử dụng WebSocket thay vì HTTP polling
2. **Multiple RPC Fallback**: Tự động chuyển RPC node khi gặp lỗi
3. **Event Batching**: Batch multiple events để giảm RPC calls
4. **Smart Retry**: Sử dụng machine learning để optimize retry strategy
