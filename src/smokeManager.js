// スモーク効果管理ユーティリティ

export function createSmokeManager(scene) {
  return {
    sprites: [],
    lastTime: 0,
    scene: scene,
    
    update(car, slipAngle, speed, heading) {
      const slipThreshold = 0.25;
      const isSliding = Math.abs(slipAngle) > slipThreshold && speed > 2.0;
      const smokeInterval = 120; // ms
      const now = Date.now();
      const startSmokeSize = 60; // px（出現時）
      const maxSmokeSize = 120; // px（最大）
      const maxAlpha = 0.7; // 70%
      const smokeLife = 1500; // 消滅までの合計時間(ms)
      const expandTime = 500; // 拡大完了までの時間(ms)
      
      // スモーク生成
      if (isSliding && (now - this.lastTime > smokeInterval)) {
        if (this.sprites.length >= 5) {
          const oldest = this.sprites.shift();
          if (oldest) oldest.destroy();
        }
        
        // 車体の中心から20%後ろの位置
        const carLength = car.displayHeight || 48;
        const backOffset = -carLength * 0.2;
        const smokeX = car.x + Math.cos(heading) * backOffset;
        const smokeY = car.y + Math.sin(heading) * backOffset;
        
        // スモークを車体の下レイヤーに
        const smoke = this.scene.add.sprite(smokeX, smokeY, 'smoke');
        smoke.setOrigin(0.5, 0.5);
        smoke.setAlpha(maxAlpha);
        
        const initialScale = startSmokeSize / smoke.width;
        smoke.setScale(initialScale);
        smoke.birthTime = now;
        this.sprites.push(smoke);
        this.lastTime = now;
        
        // レイヤーを車体の下に
        this.scene.children.moveBelow(smoke, car);
      }
      
      // スモーク更新・削除
      for (let i = this.sprites.length - 1; i >= 0; i--) {
        const smoke = this.sprites[i];
        const age = now - smoke.birthTime;
        
        // サイズ変更
        let pxScale;
        if (age < expandTime) {
          const scale = age / expandTime;
          pxScale = (startSmokeSize + (maxSmokeSize - startSmokeSize) * scale) / smoke.width;
        } else {
          pxScale = maxSmokeSize / smoke.width;
        }
        smoke.setScale(pxScale);
        
        // 透明度変更
        const alpha = Math.max(0, maxAlpha * (1 - age / smokeLife));
        smoke.setAlpha(alpha);
        
        // 削除
        if (age > smokeLife) {
          smoke.destroy();
          this.sprites.splice(i, 1);
        }
      }
    }
  };
}
