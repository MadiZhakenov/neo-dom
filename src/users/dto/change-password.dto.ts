import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /** Текущий (старый) пароль пользователя */
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  /** Новый пароль, который хочет установить пользователь */
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Новый пароль должен быть не менее 6 символов.' })
  newPassword: string;
}