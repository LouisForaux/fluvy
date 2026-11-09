/*
 * A small model of what a service call does to an entity's state — what Home Assistant would set a moment later,
 * for the domains Fluvy's cards drive. The playground's mock hass answers every tap with it, and the settings
 * panel's preview house responds to a tap the same way (a light that stays on when it is switched on, a
 * thermostat that keeps its new target), so a look is judged on cards that behave.
 *
 * Pure: `simulate` returns the entities the call changes, as new objects; nothing it does not know is touched.
 */

/** The shape of a state object this model reads and writes (Home Assistant's `HassEntity`, structurally). */
export interface SimulatedEntity {
  readonly entity_id: string;
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly last_changed: string;
  readonly last_updated: string;
}

export interface SimulatedCall {
  readonly domain: string;
  readonly service: string;
  readonly data?: Readonly<Record<string, unknown>> | undefined;
  readonly target?: { readonly entity_id?: string | readonly string[] | undefined } | undefined;
}

/** The entities a call addresses: its target, else the `entity_id` in its data. */
export function targetsOf(call: SimulatedCall): string[] {
  const raw = call.target?.entity_id ?? call.data?.['entity_id'];
  return raw === undefined ? [] : ([] as string[]).concat(raw as string | string[]);
}

export function simulate<E extends SimulatedEntity>(
  states: Readonly<Record<string, E>>,
  call: SimulatedCall,
  now: Date = new Date(),
): Record<string, E> {
  const changed: Record<string, E> = {};
  const data = call.data ?? {};
  const stamp = now.toISOString();
  const set = (
    id: string,
    state: string | undefined,
    attrs: Record<string, unknown> = {},
  ): void => {
    const previous = changed[id] ?? states[id];
    if (!previous) return;
    changed[id] = {
      ...previous,
      state: state ?? previous.state,
      attributes: { ...previous.attributes, ...attrs },
      last_changed: state !== undefined && state !== previous.state ? stamp : previous.last_changed,
      last_updated: stamp,
    };
  };
  for (const id of targetsOf(call)) {
    const s = states[id];
    if (!s) continue;
    const a = s.attributes;
    switch (`${call.domain}.${call.service}`) {
      case 'homeassistant.turn_on':
      case 'switch.turn_on':
      case 'input_boolean.turn_on':
      case 'fan.turn_on':
      case 'humidifier.turn_on':
        set(id, 'on');
        break;
      case 'homeassistant.turn_off':
      case 'switch.turn_off':
      case 'input_boolean.turn_off':
      case 'fan.turn_off':
      case 'light.turn_off':
      case 'humidifier.turn_off':
        set(id, 'off');
        break;
      case 'homeassistant.toggle':
      case 'switch.toggle':
      case 'input_boolean.toggle':
      case 'light.toggle':
      case 'fan.toggle':
        set(id, s.state === 'on' ? 'off' : 'on');
        break;
      case 'light.turn_on':
        set(id, 'on', {
          ...(data['brightness_pct'] !== undefined
            ? { brightness: Math.round((Number(data['brightness_pct']) / 100) * 255) }
            : a['brightness']
              ? {}
              : { brightness: 178 }),
          ...(data['color_temp_kelvin'] !== undefined
            ? { color_temp_kelvin: data['color_temp_kelvin'] }
            : {}),
        });
        break;
      case 'cover.open_cover':
        set(id, 'open', { current_position: 100 });
        break;
      case 'cover.close_cover':
        set(id, 'closed', { current_position: 0 });
        break;
      case 'cover.stop_cover':
        break;
      case 'cover.set_cover_position':
        set(id, Number(data['position']) > 0 ? 'open' : 'closed', {
          current_position: data['position'],
        });
        break;
      case 'cover.set_cover_tilt_position':
        set(id, undefined, { current_tilt_position: data['tilt_position'] });
        break;
      case 'cover.open_cover_tilt':
        set(id, undefined, { current_tilt_position: 100 });
        break;
      case 'cover.close_cover_tilt':
        set(id, undefined, { current_tilt_position: 0 });
        break;
      case 'fan.set_percentage':
        set(id, Number(data['percentage']) > 0 ? 'on' : 'off', {
          percentage: data['percentage'],
        });
        break;
      case 'fan.oscillate':
        set(id, undefined, { oscillating: data['oscillating'] });
        break;
      case 'fan.set_preset_mode':
        set(id, undefined, { preset_mode: data['preset_mode'] });
        break;
      case 'fan.set_direction':
        set(id, undefined, { direction: data['direction'] });
        break;
      case 'climate.set_temperature':
        set(id, undefined, {
          ...(data['temperature'] !== undefined ? { temperature: data['temperature'] } : {}),
          ...(data['target_temp_low'] !== undefined
            ? {
                target_temp_low: data['target_temp_low'],
                target_temp_high: data['target_temp_high'],
              }
            : {}),
        });
        break;
      case 'climate.set_hvac_mode':
        set(id, String(data['hvac_mode']), {
          hvac_action:
            data['hvac_mode'] === 'off'
              ? 'off'
              : data['hvac_mode'] === 'cool'
                ? 'cooling'
                : data['hvac_mode'] === 'heat'
                  ? 'heating'
                  : 'idle',
        });
        break;
      case 'climate.set_preset_mode':
        set(id, undefined, { preset_mode: data['preset_mode'] });
        break;
      case 'climate.set_fan_mode':
        set(id, undefined, { fan_mode: data['fan_mode'] });
        break;
      case 'water_heater.set_temperature':
        set(id, undefined, { temperature: data['temperature'] });
        break;
      case 'water_heater.set_operation_mode':
        set(id, String(data['operation_mode']));
        break;
      case 'humidifier.set_humidity':
        set(id, undefined, { humidity: data['humidity'] });
        break;
      case 'media_player.media_play_pause':
        set(id, s.state === 'playing' ? 'paused' : 'playing');
        break;
      case 'media_player.media_play':
        set(id, 'playing');
        break;
      case 'media_player.media_pause':
        set(id, 'paused');
        break;
      case 'media_player.volume_set':
        set(id, undefined, { volume_level: data['volume_level'] });
        break;
      case 'media_player.volume_mute':
        set(id, undefined, { is_volume_muted: data['is_volume_muted'] });
        break;
      case 'media_player.select_source':
        set(id, undefined, { source: data['source'] });
        break;
      case 'media_player.shuffle_set':
        set(id, undefined, { shuffle: data['shuffle'] });
        break;
      case 'media_player.repeat_set':
        set(id, undefined, { repeat: data['repeat'] });
        break;
      case 'media_player.media_next_track':
      case 'media_player.media_previous_track':
        set(id, undefined, { media_position: 0, media_position_updated_at: stamp });
        break;
      case 'media_player.media_seek':
        set(id, undefined, {
          media_position: Number(data['seek_position']),
          media_position_updated_at: stamp,
        });
        break;
      case 'media_player.turn_on':
        set(id, 'idle');
        break;
      case 'media_player.turn_off':
        set(id, 'off');
        break;
      case 'media_player.volume_up':
      case 'media_player.volume_down':
        set(id, undefined, {
          volume_level: Math.min(
            1,
            Math.max(
              0,
              Number(a['volume_level'] ?? 0) + (call.service === 'volume_up' ? 0.05 : -0.05),
            ),
          ),
        });
        break;
      case 'media_player.media_stop':
        set(id, 'idle');
        break;
      // a remote: switched on or off, and the last key it was sent (the remote card's, read back by its tests)
      case 'remote.turn_on':
        set(id, 'on');
        break;
      case 'remote.turn_off':
        set(id, 'off');
        break;
      case 'remote.send_command':
        set(id, undefined, {
          last_command: ([] as unknown[])
            .concat(data['command'] as never)
            .map(String)
            .join(' '),
        });
        break;
      case 'vacuum.start':
        set(id, 'cleaning');
        break;
      case 'vacuum.pause':
        set(id, 'paused');
        break;
      case 'vacuum.stop':
        set(id, 'idle');
        break;
      case 'vacuum.return_to_base':
        set(id, 'returning');
        break;
      case 'vacuum.set_fan_speed':
        set(id, undefined, { fan_speed: data['fan_speed'] });
        break;
      case 'lawn_mower.start_mowing':
        set(id, 'mowing');
        break;
      case 'lawn_mower.pause':
        set(id, 'paused');
        break;
      case 'lawn_mower.dock':
        set(id, 'docked');
        break;
      case 'lock.lock':
        set(id, 'locked');
        break;
      case 'lock.unlock':
        set(id, 'unlocked');
        break;
      case 'lock.open':
        set(id, 'open');
        break;
      case 'alarm_control_panel.alarm_disarm':
        set(id, 'disarmed');
        break;
      case 'alarm_control_panel.alarm_arm_home':
        set(id, 'armed_home');
        break;
      case 'alarm_control_panel.alarm_arm_away':
        set(id, 'armed_away');
        break;
      case 'alarm_control_panel.alarm_arm_night':
        set(id, 'armed_night');
        break;
      case 'alarm_control_panel.alarm_arm_vacation':
        set(id, 'armed_vacation');
        break;
      case 'alarm_control_panel.alarm_arm_custom_bypass':
        set(id, 'armed_custom_bypass');
        break;
      case 'input_number.set_value':
      case 'number.set_value':
        set(id, String(data['value']));
        break;
      case 'input_select.select_option':
      case 'select.select_option':
        set(id, String(data['option']));
        break;
      case 'input_text.set_value':
      case 'text.set_value':
        set(id, String(data['value']));
        break;
      case 'timer.start':
        set(id, 'active');
        break;
      case 'timer.pause':
        set(id, 'paused');
        break;
      case 'timer.cancel':
        set(id, 'idle');
        break;
      case 'scene.turn_on':
      case 'script.turn_on':
      case 'button.press':
      case 'input_button.press':
        set(id, stamp);
        break;
      case 'timer.finish':
        set(id, 'idle', { remaining: '0:00:00' });
        break;
      case 'counter.increment':
        set(id, String(Number(s.state || 0) + Number(a['step'] ?? 1)));
        break;
      case 'counter.decrement':
        set(id, String(Number(s.state || 0) - Number(a['step'] ?? 1)));
        break;
      case 'counter.reset':
        set(id, String(Number(a['initial'] ?? 0)));
        break;
      case 'automation.turn_on':
        set(id, 'on');
        break;
      case 'automation.turn_off':
        set(id, 'off');
        break;
      case 'automation.toggle':
        set(id, s.state === 'on' ? 'off' : 'on');
        break;
      case 'automation.trigger':
        set(id, undefined, { last_triggered: stamp });
        break;
      case 'update.install':
        set(id, undefined, { in_progress: true, update_percentage: 0 });
        break;
      case 'todo.add_item':
        set(id, String(Number(s.state || 0) + 1));
        break;
      case 'todo.update_item':
        set(
          id,
          String(Math.max(0, Number(s.state || 0) + (data['status'] === 'completed' ? -1 : 1))),
        );
        break;
      case 'todo.remove_item':
        set(id, undefined);
        break;
      case 'valve.open_valve':
        set(id, 'open');
        break;
      case 'valve.close_valve':
        set(id, 'closed');
        break;
      case 'valve.set_valve_position':
        set(id, Number(data['position']) > 0 ? 'open' : 'closed', {
          current_position: data['position'],
        });
        break;
      case 'input_datetime.set_datetime':
      case 'time.set_value':
        if (data['time'] !== undefined) set(id, String(data['time']));
        break;
      default:
        break;
    }
  }
  return changed;
}
